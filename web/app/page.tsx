import Image from 'next/image';
import Link from 'next/link';
import { Crop, Printer, Search, Sparkles } from 'lucide-react';
import ShopVideoSection from './components/shopVideoSection';
import {
  accentPhoto,
  galleryPhotos,
  heroPhoto,
  interiorPhotos,
  lidPhoto,
  windowPhoto,
  type DeckPhoto,
} from './lib/deckBoxPhotos';

const STEPS = [
  {
    icon: Search,
    title: 'Search your commander',
    body: 'Find the legendary card. We pull the official art.',
  },
  {
    icon: Sparkles,
    title: 'AI extends the art',
    body: 'The picture grows so it can wrap the front, the spine, and the back.',
  },
  {
    icon: Crop,
    title: 'Crop the faces',
    body: 'Drag the frame until the portrait sits where you want it on the box.',
  },
  {
    icon: Printer,
    title: 'We print and ship',
    body: 'You get a receipt and tracking. We print the box and send it.',
  },
];

const FEATURES: Array<{
  eyebrow: string;
  title: string;
  body: string;
  photos: DeckPhoto[];
  flip?: boolean;
}> = [
  {
    eyebrow: 'Window',
    title: 'The window and the commander',
    body: 'The front window holds the commander card. The same portrait continues around the sides as a multi-colour layered filament print.',
    photos: [windowPhoto],
  },
  {
    eyebrow: 'Inside',
    title: 'Interior and token storage',
    body: 'The deck sits in the box. A tray along the back keeps tokens with it, and the lid lifts off. The open tray on the right is an Elven Council box.',
    photos: interiorPhotos,
    flip: true,
  },
  {
    eyebrow: 'Lid',
    title: 'The lid',
    body: 'A planeswalker symbol and the deck name are printed on the lid. It seats on the box and comes off when you play.',
    photos: [lidPhoto],
  },
];

function FramePhoto({
  photo,
  sizes,
  priority = false,
}: {
  photo: DeckPhoto;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-black ${photo.frame ?? 'aspect-[3/4]'}`}>
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes={sizes}
        quality={75}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        className={`object-cover ${photo.focus ?? 'object-center'}`}
      />
    </div>
  );
}

export default function FrontPage() {
  return (
    <main className="bg-[#12141f] font-serif text-white">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(226,194,117,0.16),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e2c275]">Commander Deck Box</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-[#f3e6c4] sm:text-5xl">
              Your commander, printed on the box.
            </h1>
            <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-gray-300 sm:text-lg">
              Search the card, extend the art around the three faces, and we print a multi-colour layered filament deck box and ship it to you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/box"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#e2c275] px-6 text-base font-semibold text-black hover:bg-[#efd397]"
              >
                Design your box
              </Link>
              <Link
                href="/track"
                className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/20 px-6 text-base text-gray-100 hover:border-[#e2c275]/60"
              >
                Track an order
              </Link>
            </div>
          </div>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-[#e2c275]/35 bg-black shadow-2xl shadow-black/40">
            <Image
              src={heroPhoto.src}
              alt={heroPhoto.alt}
              fill
              priority
              quality={75}
              sizes="(min-width: 768px) 448px, 92vw"
              className={`object-cover ${heroPhoto.focus ?? 'object-center'}`}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0e121c]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold text-[#f3e6c4]">How a box gets made</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-[#e2c275] font-sans text-sm font-bold text-black">
                      {index + 1}
                    </span>
                    <Icon className="h-5 w-5 text-[#e2c275]" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#e2c275]">{step.title}</h3>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-gray-300">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-3xl font-bold text-[#f3e6c4]">Built for a commander deck</h2>
        <p className="mt-3 max-w-2xl font-sans text-gray-300">
          The picture on the box is a multi-colour layered filament print. Filament swaps through the thickness of the portrait, so the colour is in the plastic, not on a sticker.
        </p>
        <div className="mt-10 space-y-14">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
              <div className={feature.flip ? 'md:order-2' : undefined}>
                {feature.photos.length === 1 ? (
                  <div className="mx-auto w-full max-w-md">
                    <FramePhoto photo={feature.photos[0]} sizes="(min-width: 768px) 448px, 92vw" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {feature.photos.map((photo) => (
                      <FramePhoto key={photo.src} photo={photo} sizes="(min-width: 768px) 280px, 46vw" />
                    ))}
                  </div>
                )}
              </div>
              <div className={feature.flip ? 'md:order-1' : undefined}>
                <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-[#e2c275]">{feature.eyebrow}</p>
                <h3 className="mt-2 text-2xl font-semibold text-[#f3e6c4]">{feature.title}</h3>
                <p className="mt-3 font-sans leading-relaxed text-gray-300">{feature.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0e121c]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-bold text-[#f3e6c4]">From the bench</h2>
          <p className="mt-3 max-w-2xl font-sans text-gray-300">
            More angles of the same prints: the window, the open box, and the lid on the table.
          </p>
          <div className="mt-8 columns-2 gap-3 sm:columns-3 lg:columns-4">
            {galleryPhotos.map((photo) => (
              <figure key={photo.src} className="mb-3 break-inside-avoid">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
                  quality={65}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto' }}
                  className="rounded-xl border border-white/10 bg-black/40"
                />
              </figure>
            ))}
          </div>
          <figure className="mt-8 flex max-w-lg items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <Image
              src={accentPhoto.src}
              alt={accentPhoto.alt}
              width={accentPhoto.width}
              height={accentPhoto.height}
              sizes="128px"
              quality={75}
              loading="lazy"
              style={{ width: '128px', height: 'auto', maxWidth: '34vw' }}
              className="shrink-0 rounded-lg border border-white/10"
            />
            <figcaption className="font-sans text-sm leading-relaxed text-gray-300">
              <span className="block font-semibold text-[#e2c275]">Madame Coco</span>
              A smaller pink box, held in hand, with the commander in the window.
            </figcaption>
          </figure>
        </div>
      </section>

      <ShopVideoSection />

      <section className="border-t border-[#e2c275]/20 bg-[#1a1a2e]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#f3e6c4]">Frame a commander.</h2>
            <p className="mt-2 font-sans text-gray-300">Search the card, crop the faces, and place the order.</p>
          </div>
          <Link
            href="/box"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#e2c275] px-6 font-semibold text-black hover:bg-[#efd397]"
          >
            Design your box
          </Link>
        </div>
      </section>
    </main>
  );
}
