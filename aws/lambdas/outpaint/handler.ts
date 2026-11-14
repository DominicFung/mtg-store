import { createHash } from 'node:crypto';
import type { AppSyncResolverEvent } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { HeadObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import {
  extendSideForSubject,
  extendToAspect,
  outpaintMargins,
  placeSubject,
  subjectBounds,
  WRAP_ASPECT,
  type ExtendSide,
  type SubjectBounds,
} from '../../../packages/print-core/src/outpaint';
import { requiredEnv, s3 } from '../orders/store';

const ALLOWED = [/^https:\/\/cards\.scryfall\.io\//, /^https:\/\/api\.scryfall\.com\//];
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const DEFAULT_MODEL = 'us.stability.stable-outpaint-v1:0';

type OutpaintArgs = { imageUrl: string; side?: string | null };

/**
 * Extends commander art on one side so the subject can sit on the front or the
 * back, never centred on the spine. BEDROCK_IMAGE_MODEL overrides the model id
 * (default us.stability.stable-outpaint-v1:0). `side` is "left" or "right";
 * omit it and the empty side is chosen from the subject. Each side is cached
 * on its own under outpaint/v2 so a flip does not reuse the other direction
 * and does not pay for a second generation until it is requested.
 * If Bedrock rejects the call, the one-sided edge extension is cached instead.
 */
export const handler = async (event: AppSyncResolverEvent<OutpaintArgs>) => {
  const imageUrl = event.arguments?.imageUrl ?? '';
  if (!ALLOWED.some((pattern) => pattern.test(imageUrl))) throw new Error('Artwork must come from Scryfall');
  const upstream = await fetch(imageUrl, {
    headers: { Accept: 'image/*', 'User-Agent': 'ManaRamp/1.0 (themanaramp.ca)' },
  });
  if (!upstream.ok) throw new Error(`Could not fetch the card art (${upstream.status})`);
  const original = Buffer.from(await upstream.arrayBuffer());
  const decoded = decodeImage(original);
  const bounds = subjectBounds(decoded);
  const side = requestedSide(event.arguments?.side) ?? extendSideForSubject(bounds.center);
  const margins = outpaintMargins(decoded.width, decoded.height, bounds, side);
  const target = extendToAspect(decoded, WRAP_ASPECT, side);
  const hash = createHash('sha256')
    .update(original)
    .update(side)
    .update(String(margins.left))
    .update(String(margins.right))
    .digest('hex');
  const key = `outpaint/v2/${side}/${hash}.png`;
  const cached = await readCache(key);
  if (cached) return result(cached.url, 'cache', cached.width, cached.height, side, cached.subject);

  let png = encodePng(target.rgba, target.width, target.height);
  let source = 'edge-extend';
  let width = target.width;
  let height = target.height;
  const modelId = process.env.BEDROCK_IMAGE_MODEL || DEFAULT_MODEL;
  if (margins.left + margins.right > 0) {
    try {
      png = await outpaintWithBedrock(modelId, decoded, margins);
      const produced = decodeImage(png);
      width = produced.width;
      height = produced.height;
      source = modelId;
    } catch (error) {
      console.error('Bedrock outpaint unavailable; using the one-sided edge extension', error);
    }
  }
  const subject = placeSubject(bounds, decoded.width, width, side);
  await s3.send(new PutObjectCommand({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Key: key,
    Body: png,
    ContentType: 'image/png',
    CacheControl: 'private, no-store',
    Metadata: {
      width: String(width),
      height: String(height),
      side,
      subjectleft: String(subject.left),
      subjectright: String(subject.right),
      subjectcenter: String(subject.center),
    },
  }));
  const stored = await readCache(key);
  return result(stored?.url ?? '', source, width, height, side, subject);
};

function result(
  imageUrl: string | null,
  source: string,
  width: number,
  height: number,
  side: ExtendSide,
  subject: SubjectBounds,
) {
  return {
    imageUrl,
    source,
    width,
    height,
    side,
    subjectLeft: subject.left,
    subjectRight: subject.right,
    subjectCenter: subject.center,
  };
}

function requestedSide(value: string | null | undefined): ExtendSide | null {
  return value === 'left' || value === 'right' ? value : null;
}

async function readCache(key: string): Promise<{
  url: string;
  width: number;
  height: number;
  subject: SubjectBounds;
} | null> {
  const bucket = requiredEnv('ORDER_BUCKET_NAME');
  let meta: Record<string, string> | undefined;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    meta = head.Metadata;
  } catch {
    return null;
  }
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 60 * 60 });
  const subject = {
    left: Number(meta?.subjectleft),
    right: Number(meta?.subjectright),
    center: Number(meta?.subjectcenter),
  };
  if (![subject.left, subject.right, subject.center].every(Number.isFinite)) return null;
  return {
    url,
    width: Number(meta?.width) || 0,
    height: Number(meta?.height) || 0,
    subject,
  };
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
    up: 0,
    down: 0,
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
