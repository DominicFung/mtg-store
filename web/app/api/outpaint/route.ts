import { decode as decodeJpeg } from 'jpeg-js';
import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';
import {
  extendSideForSubject,
  extendToAspect,
  placeSubject,
  subjectBounds,
  WRAP_ASPECT,
  type ExtendSide,
  type SubjectBounds,
} from '../../../../packages/print-core/src/outpaint';
import { isFetchableArtUrl, isScryfallArtUrl } from '../../lib/artHost';
import { publicConfig } from '../../lib/publicConfig';

export const runtime = 'nodejs';
export const maxDuration = 60;

type OutpaintBody = {
  image: string;
  source: string;
  side: ExtendSide;
  subject: SubjectBounds;
  width: number;
  height: number;
};

/**
 * Extends commander art to the three-face frame and returns a same-origin
 * data URL. When the shop API is configured this calls the outpaint Lambda
 * (Stability, cached per side in S3) and inlines the object. Otherwise it
 * repeats the near edge on one side, which is the same placement the Lambda
 * uses when Bedrock is unavailable.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { imageUrl?: string; side?: string } | null;
  const imageUrl = body?.imageUrl ?? '';
  if (!isScryfallArtUrl(imageUrl)) {
    return NextResponse.json({ error: 'Artwork must come from Scryfall' }, { status: 400 });
  }
  const requested = body?.side === 'left' || body?.side === 'right' ? body.side : null;

  if (publicConfig.appsyncUrl && publicConfig.appsyncApiKey) {
    try {
      const remote = await outpaintRemote(imageUrl, requested);
      const image = await inlineImage(remote.imageUrl);
      return NextResponse.json({
        image,
        source: remote.source,
        side: remote.side,
        subject: {
          left: remote.subjectLeft,
          right: remote.subjectRight,
          center: remote.subjectCenter,
        },
        width: remote.width,
        height: remote.height,
      } satisfies OutpaintBody);
    } catch (error) {
      console.error('Remote outpaint failed; extending the near edge', error);
    }
  }

  try {
    const local = await extendLocally(imageUrl, requested);
    return NextResponse.json(local);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not extend the artwork';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function extendLocally(imageUrl: string, requested: ExtendSide | null): Promise<OutpaintBody> {
  const upstream = await fetch(imageUrl, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'ManaRamp/1.0 (themanaramp.ca)',
    },
    redirect: 'follow',
  });
  if (!upstream.ok) throw new Error(`Could not fetch the card art (${upstream.status})`);
  const bytes = Buffer.from(await upstream.arrayBuffer());
  const decoded = decodeImage(bytes);
  const bounds = subjectBounds(decoded);
  const side = requested ?? extendSideForSubject(bounds.center);
  const extended = extendToAspect(decoded, WRAP_ASPECT, side);
  const png = new PNG({ width: extended.width, height: extended.height });
  Buffer.from(extended.rgba).copy(png.data);
  const encoded = PNG.sync.write(png);
  return {
    image: `data:image/png;base64,${encoded.toString('base64')}`,
    source: 'edge-extend',
    side,
    subject: placeSubject(bounds, decoded.width, extended.width, side),
    width: extended.width,
    height: extended.height,
  };
}

type RemoteOutpaint = {
  imageUrl: string;
  source: string;
  width: number;
  height: number;
  side: ExtendSide;
  subjectLeft: number;
  subjectRight: number;
  subjectCenter: number;
};

async function outpaintRemote(imageUrl: string, side: ExtendSide | null): Promise<RemoteOutpaint> {
  const response = await fetch(publicConfig.appsyncUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': publicConfig.appsyncApiKey,
    },
    body: JSON.stringify({
      query: `query Outpaint($imageUrl: String!, $side: String) {
        outpaintCommanderArt(imageUrl: $imageUrl, side: $side) {
          imageUrl source width height side subjectLeft subjectRight subjectCenter
        }
      }`,
      variables: { imageUrl, side },
    }),
  });
  const body = await response.json() as {
    data?: { outpaintCommanderArt?: RemoteOutpaint };
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) throw new Error(body.errors[0].message || 'The shop API rejected the outpaint');
  const result = body.data?.outpaintCommanderArt;
  if (!result?.imageUrl) throw new Error('Could not extend the artwork');
  if (result.side !== 'left' && result.side !== 'right') throw new Error('The outpaint did not choose a side');
  return result;
}

async function inlineImage(url: string): Promise<string> {
  if (url.startsWith('data:image/')) return url;
  if (!isFetchableArtUrl(url)) throw new Error('The extended artwork host is not allowed');
  const response = await fetch(url, {
    headers: { Accept: 'image/*' },
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Could not read the extended artwork (${response.status})`);
  const type = response.headers.get('content-type')?.split(';')[0] || 'image/png';
  if (!type.startsWith('image/')) throw new Error('The extended artwork was not an image');
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${type};base64,${bytes.toString('base64')}`;
}

function decodeImage(bytes: Buffer): { rgba: Uint8Array; width: number; height: number } {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const png = PNG.sync.read(bytes);
    return { rgba: new Uint8Array(png.data), width: png.width, height: png.height };
  }
  const jpeg = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
  return { rgba: new Uint8Array(jpeg.data), width: jpeg.width, height: jpeg.height };
}
