import { createHash } from 'node:crypto';
import type { AppSyncResolverEvent } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { extendToAspect, WRAP_ASPECT } from '../../../packages/print-core/src/outpaint';
import { requiredEnv, s3 } from '../orders/store';

const ALLOWED = [/^https:\/\/cards\.scryfall\.io\//, /^https:\/\/api\.scryfall\.com\//];
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Extends commander art to the three-face frame.
 * Tries Amazon Nova Canvas outpainting in us-east-1, then Titan Image Generator v2.
 * If neither model is enabled, the edge extend is cached instead so the order can continue.
 * Dominic enables the model under Bedrock → Model access in us-east-1.
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
  const modelId = process.env.BEDROCK_IMAGE_MODEL || 'amazon.nova-canvas-v1:0';
  try {
    const painted = await outpaintWithBedrock(modelId, decoded, target.width, target.height);
    png = painted;
    source = modelId;
  } catch (error) {
    const fallback = process.env.BEDROCK_FALLBACK_MODEL || 'amazon.titan-image-generator-v2:0';
    if (fallback !== modelId) {
      try {
        png = await outpaintWithBedrock(fallback, decoded, target.width, target.height);
        source = fallback;
      } catch (second) {
        console.error('Bedrock outpaint unavailable', error, second);
      }
    } else {
      console.error('Bedrock outpaint unavailable', error);
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

async function outpaintWithBedrock(modelId: string, source: { rgba: Uint8Array; width: number; height: number }, width: number, height: number): Promise<Buffer> {
  const fitted = fitBedrock(source, width, height);
  const body = JSON.stringify({
    taskType: 'OUTPAINTING',
    outPaintingParams: {
      text: 'Extend the existing background seamlessly to the sides. Keep the same lighting and style. Do not add characters, text, cards, or a frame.',
      negativeText: 'text, watermark, frame, border, signature, new character',
      image: fitted.image.toString('base64'),
      maskImage: fitted.mask.toString('base64'),
      outPaintingMode: 'DEFAULT',
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      width: fitted.width,
      height: fitted.height,
      cfgScale: 7,
    },
  });
  const result = await bedrock.send(new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: new TextEncoder().encode(body),
  }));
  const parsed = JSON.parse(new TextDecoder().decode(result.body)) as { images?: string[] };
  const image = parsed.images?.[0];
  if (!image) throw new Error('Bedrock returned no image');
  return Buffer.from(image, 'base64');
}

function fitBedrock(source: { rgba: Uint8Array; width: number; height: number }, width: number, height: number) {
  const snap = (value: number) => Math.max(320, Math.min(1408, Math.round(value / 16) * 16));
  const nextWidth = snap(width);
  const nextHeight = snap(height);
  const extended = extendToAspect(source, nextWidth / nextHeight);
  const image = encodePng(extended.rgba, extended.width, extended.height);
  const mask = new PNG({ width: extended.width, height: extended.height });
  const originX = Math.floor((extended.width - source.width) / 2);
  const originY = Math.floor((extended.height - source.height) / 2);
  for (let y = 0; y < extended.height; y += 1) {
    for (let x = 0; x < extended.width; x += 1) {
      const inside = x >= originX && x < originX + source.width && y >= originY && y < originY + source.height;
      const offset = (y * extended.width + x) * 4;
      const value = inside ? 0 : 255;
      mask.data[offset] = value;
      mask.data[offset + 1] = value;
      mask.data[offset + 2] = value;
      mask.data[offset + 3] = 255;
    }
  }
  return { image, mask: PNG.sync.write(mask), width: extended.width, height: extended.height };
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
