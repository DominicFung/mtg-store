'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PHOTOS = [
  {
    src: '/images/1F382F41-E88E-4192-815E-756C3A653F2D_1_105_c.jpeg',
    alt: 'Three printed commander deck boxes with the art on the sides',
  },
  {
    src: '/images/19C48FF5-CF48-4199-9D53-A6DB3112BDC8_1_105_c.jpeg',
    alt: 'Commander deck boxes with the card showing in the front window',
  },
  {
    src: '/images/1801181C-5A70-41EF-BFDA-E37758F04E91_1_105_c.jpeg',
    alt: 'Printed deck boxes with multi-colour filament portraits',
  },
  {
    src: '/images/B24D1D86-3792-46B5-A4F6-51A094D4A847_1_105_c.jpeg',
    alt: 'Deck boxes from above, with the tops and front windows visible',
  },
];

export default function BoxCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % PHOTOS.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [paused]);

  const step = (direction: number) => {
    setIndex((current) => (current + direction + PHOTOS.length) % PHOTOS.length);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[#e2c275]/35 bg-black shadow-2xl shadow-black/40">
        {PHOTOS.map((photo, photoIndex) => (
          <Image
            key={photo.src}
            src={photo.src}
            alt={photoIndex === index ? photo.alt : ''}
            fill
            priority={photoIndex === 0}
            sizes="(min-width: 1024px) 560px, 100vw"
            className={`object-cover object-[center_38%] transition-opacity duration-500 ${photoIndex === index ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={photoIndex !== index}
          />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => step(-1)}
        className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => step(1)}
        className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="mt-3 flex justify-center gap-2">
        {PHOTOS.map((photo, photoIndex) => (
          <button
            key={photo.src}
            type="button"
            aria-label={`Show photo ${photoIndex + 1}`}
            aria-current={photoIndex === index}
            onClick={() => setIndex(photoIndex)}
            className={`h-2.5 w-2.5 rounded-full ${photoIndex === index ? 'bg-[#e2c275]' : 'bg-white/30'}`}
          />
        ))}
      </div>
    </div>
  );
}
