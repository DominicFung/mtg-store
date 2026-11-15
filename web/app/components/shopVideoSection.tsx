import { findShopVideo } from '../lib/shopVideoFile';
import ShopVideo from './shopVideo';

/** Unmounted until public/videos has both a video file and a poster. */
export default function ShopVideoSection() {
  const video = findShopVideo();
  if (!video) return null;
  return <ShopVideo src={video.src} poster={video.poster} type={video.type} />;
}
