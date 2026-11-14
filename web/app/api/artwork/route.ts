import { NextResponse } from 'next/server';
import { isFetchableArtUrl } from '../../lib/artHost';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Same-origin image bytes. The cropper must never draw a Scryfall or S3 URL
 * onto a canvas: those responses taint it, and a cached non-CORS copy makes
 * the next read fail too. This route fetches the allowed host server-side.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { url?: string } | null;
  const url = body?.url ?? '';
  if (!isFetchableArtUrl(url)) {
    return NextResponse.json({ error: 'Artwork host is not allowed' }, { status: 400 });
  }
  const upstream = await fetch(url, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'ManaRamp/1.0 (themanaramp.ca)',
    },
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!upstream.ok) {
    return NextResponse.json({ error: `Could not load the artwork (${upstream.status})` }, { status: 502 });
  }
  const type = upstream.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
  if (!type.startsWith('image/')) {
    return NextResponse.json({ error: 'The artwork was not an image' }, { status: 502 });
  }
  const bytes = Buffer.from(await upstream.arrayBuffer());
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, no-store',
    },
  });
}
