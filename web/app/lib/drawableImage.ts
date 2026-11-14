import { isFetchableArtUrl } from './artHost';

/**
 * A src the canvas can export. Data and blob URLs are already same-origin.
 * Anything else is fetched through /api/artwork so the browser never decodes
 * a cross-origin image into the crop canvas.
 */
export async function toDrawableSrc(src: string): Promise<string> {
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  if (!isFetchableArtUrl(src)) throw new Error('The artwork host is not allowed');
  const response = await fetch('/api/artwork', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ url: src }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || 'Could not load the artwork');
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
