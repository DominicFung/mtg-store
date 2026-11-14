import { decode as decodeJpeg } from 'jpeg-js';
import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';
import { extendToAspect, WRAP_ASPECT } from '../../../../packages/print-core/src/outpaint';

export const runtime = 'nodejs';

const ALLOWED = [/^https:\/\/cards\.scryfall\.io\//, /^https:\/\/api\.scryfall\.com\//];

/**
 * Browser stand-in for the outpaint Lambda. Production calls Amazon Bedrock
 * from aws/lambdas/outpaint and caches the PNG. This route only accepts
 * Scryfall art and extends the edges to the three-face frame.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { imageUrl?: string } | null;
  const imageUrl = body?.imageUrl ?? '';
  if (!ALLOWED.some((pattern) => pattern.test(imageUrl))) {
    return NextResponse.json({ error: 'Artwork must come from Scryfall' }, { status: 400 });
  }
  const upstream = await fetch(imageUrl, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'ManaRamp/1.0 (themanaramp.ca)',
    },
    redirect: 'follow',
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: `Could not fetch the card art (${upstream.status})` }, { status: 502 });
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  const decoded = decodeImage(bytes);
  const extended = extendToAspect(decoded, WRAP_ASPECT);
  const png = new PNG({ width: extended.width, height: extended.height });
  Buffer.from(extended.rgba).copy(png.data);
  const encoded = PNG.sync.write(png);
  return NextResponse.json({
    image: `data:image/png;base64,${encoded.toString('base64')}`,
    source: 'edge-extend',
    width: extended.width,
    height: extended.height,
  });
}

function decodeImage(bytes: Buffer): { rgba: Uint8Array; width: number; height: number } {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const png = PNG.sync.read(bytes);
    return { rgba: new Uint8Array(png.data), width: png.width, height: png.height };
  }
  const jpeg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  return { rgba: new Uint8Array(jpeg.data), width: jpeg.width, height: jpeg.height };
}
