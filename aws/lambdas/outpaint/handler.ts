import { createHash } from 'node:crypto';
import type { AppSyncResolverEvent } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { extendToAspect, outpaintMargins, WRAP_ASPECT } from '../../../packages/print-core/src/outpaint';
import { requiredEnv, s3 } from '../orders/store';

const ALLOWED = [/^https:\/\/cards\.scryfall\.io\//, /^https:\/\/api\.scryfall\.com\//];
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const DEFAULT_MODEL = 'us.stability.stable-outpaint-v1:0';

/**
 * Extends commander art to the three-face frame with Stability Image Outpaint.
 * BEDROCK_IMAGE_MODEL overrides the model id (default us.stability.stable-outpaint-v1:0).
 * If Bedrock rejects the call, the edge extension is cached so the crop can continue.
 */
export const handler = async (event: AppSyncResolverEvent<{ imageUrl: string }>) => {
  const imageUrl = event.arguments?.imageUrl ?? '';
  if (!ALLOWED.some((pattern) => pattern.test(imageUrl))) throw new Error('Artwork must come from Scryfall');
  const upstream = await fetch(imageUrl, {
    headers: { Accept: 'image/*', 'User-Agent': 'ManaRamp/1.0 (themanaramp.ca)' },
  });
  if (!upstream.ok) throw new Error(`Could not fetch the card art (${upstream.status})`);
  const original = Buffer.from(await upstream.arrayBuffer());
  const decoded = decodeImage(original);
  const target = extendToAspect(decoded, WRAP_ASPECT);
  const hash = createHash('sha256').update(original).update(String(target.width)).update(String(target.height)).digest('hex');
  const key = `outpaint/${hash}.png`;
  const cached = await readCache(key);
  if (cached) return { imageUrl: cached, source: 'cache', width: target.width, height: target.height };

  let png = encodePng(target.rgba, target.width, target.height);
  let source = 'edge-extend';
  const modelId = process.env.BEDROCK_IMAGE_MODEL || DEFAULT_MODEL;
  const margins = outpaintMargins(decoded.width, decoded.height);
  if (margins.left + margins.right + margins.up + margins.down > 0) {
    try {
      png = await outpaintWithBedrock(modelId, decoded, margins);
      source = modelId;
    } catch (error) {
      console.error('Bedrock outpaint unavailable; using the edge extension', error);
    }
  }
  await s3.send(new PutObjectCommand({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Key: key,
    Body: png,
    ContentType: 'image/png',
  }));
  return { imageUrl: await readCache(key), source, width: target.width, height: target.height };
};

async function readCache(key: string): Promise<string | null> {
  try {
    await s3.send(new GetObjectCommand({ Bucket: requiredEnv('ORDER_BUCKET_NAME'), Key: key }));
  } catch {
    return null;
  }
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: requiredEnv('ORDER_BUCKET_NAME'), Key: key }), { expiresIn: 60 * 60 });
}

async function outpaintWithBedrock(
  modelId: string,
  source: { rgba: Uint8Array; width: number; height: number },
  margins: { left: number; right: number; up: number; down: number },
): Promise<Buffer> {
  const body = JSON.stringify({
    image: encodePng(source.rgba, source.width, source.height).toString('base64'),
    prompt: 'Extend the existing background seamlessly. Keep the same lighting and style. Do not add characters, text, or a frame.',
    left: margins.left,
    right: margins.right,
    up: margins.up,
    down: margins.down,
    creativity: 0.35,
    output_format: 'png',
  });
  const result = await bedrock.send(new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  }));
  const raw = new TextDecoder().decode(result.body);
  let parsed: { images?: string[]; image?: string; finish_reasons?: Array<string | null> };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return Buffer.from(result.body);
  }
  const blocked = parsed.finish_reasons?.find((reason) => reason);
  if (blocked) throw new Error(`Bedrock outpaint was blocked: ${blocked}`);
  const image = parsed.images?.[0] ?? parsed.image;
  if (!image) throw new Error('Bedrock returned no image');
  return Buffer.from(image, 'base64');
}

function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  Buffer.from(rgba).copy(png.data);
  return PNG.sync.write(png);
}

function decodeImage(bytes: Buffer): { rgba: Uint8Array; width: number; height: number } {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const png = PNG.sync.read(bytes);
    return { rgba: new Uint8Array(png.data), width: png.width, height: png.height };
  }
  const jpeg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  return { rgba: new Uint8Array(jpeg.data), width: jpeg.width, height: jpeg.height };
}
