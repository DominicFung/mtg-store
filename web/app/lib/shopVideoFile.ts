import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const VIDEO_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const POSTER_EXTENSIONS = ['.webp', '.jpg', '.jpeg', '.png'];

export type ShopVideoSource = {
  src: string;
  poster: string;
  type: string;
};

/**
 * Looks in public/videos for a silent loop. Returns null unless both a video
 * and a poster image are present, so the home page leaves the player unmounted.
 * Poster may share the video's base name, or be named poster.webp (or jpg/png).
 */
export function findShopVideoIn(dir: string, publicPrefix = '/videos'): ShopVideoSource | null {
  if (!existsSync(dir)) return null;
  const names = readdirSync(dir);
  const videoName = names
    .filter((name) => VIDEO_TYPES[path.extname(name).toLowerCase()])
    .sort()[0];
  if (!videoName) return null;
  const stem = path.parse(videoName).name;
  const posterName = [
    ...POSTER_EXTENSIONS.map((ext) => `${stem}${ext}`),
    ...POSTER_EXTENSIONS.map((ext) => `poster${ext}`),
  ].find((name) => names.includes(name));
  if (!posterName) return null;
  const ext = path.extname(videoName).toLowerCase();
  return {
    src: `${publicPrefix}/${videoName}`,
    poster: `${publicPrefix}/${posterName}`,
    type: VIDEO_TYPES[ext],
  };
}

export function findShopVideo(): ShopVideoSource | null {
  return findShopVideoIn(path.join(process.cwd(), 'public', 'videos'));
}
