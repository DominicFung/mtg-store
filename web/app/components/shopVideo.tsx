'use client';

import { useEffect, useRef } from 'react';

type ShopVideoProps = {
  src: string;
  poster: string;
  type: string;
  label?: string;
};

function lockMute(video: HTMLVideoElement) {
  if (video.muted && video.volume === 0) return;
  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;
}

/**
 * Silent looping player. No controls, so there is no volume button.
 * Unmount the section when src is missing; this component always expects a file.
 */
export default function ShopVideo({
  src,
  poster,
  type,
  label = 'A printed commander deck box',
}: ShopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const silence = () => lockMute(video);
    const sync = () => {
      silence();
      if (motion.matches) {
        video.autoplay = false;
        video.pause();
        return;
      }
      video.autoplay = true;
      void video.play().catch(() => undefined);
    };

    sync();
    video.addEventListener('volumechange', silence);
    video.addEventListener('play', silence);
    motion.addEventListener('change', sync);
    return () => {
      video.removeEventListener('volumechange', silence);
      video.removeEventListener('play', silence);
      motion.removeEventListener('change', sync);
    };
  }, [src]);

  return (
    <section aria-label={label} className="border-t border-white/10 bg-[#0e121c]">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-3xl font-bold text-[#f3e6c4]">In motion</h2>
        <p className="mt-3 font-sans text-gray-300">A short loop of a printed box. The player stays silent.</p>
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e2c275]/25 bg-black">
          <video
            ref={ref}
            muted
            autoPlay
            loop
            playsInline
            poster={poster}
            preload="metadata"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            aria-label={label}
            className="aspect-video w-full bg-black object-cover"
          >
            <source src={src} type={type} />
          </video>
        </div>
      </div>
    </section>
  );
}
