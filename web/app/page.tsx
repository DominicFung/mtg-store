import Image from 'next/image';
import Link from 'next/link';
import { Crop, Printer, Search, Sparkles } from 'lucide-react';
import BoxCarousel from './components/boxCarousel';

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

export default function FrontPage() {
  return (
    <div className="bg-[#12141f] font-serif text-white">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(226,194,117,0.16),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e2c275]">Commander Deck Box</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-[#f3e6c4] sm:text-5xl">
              Your commander, printed on the box.
            </h1>
            <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-gray-300 sm:text-lg">
              Search the card, extend the art around the three faces, and we print a multi-colour filament deck box and ship it to you.
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
          <BoxCarousel />
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
        <h2 className="text-3xl font-bold text-[#f3e6c4]">Colour in the plastic</h2>
        <p className="mt-3 max-w-2xl font-sans text-gray-300">
          These are boxes from the shop. The portrait is filament, not a sticker.
        </p>
        <div className="mt-10 space-y-12">
          <article className="grid items-center gap-6 md:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
              <Image
                src="/images/1801181C-5A70-41EF-BFDA-E37758F04E91_1_105_c.jpeg"
                alt="Three deck boxes showing multi-colour filament art on the sides"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover object-[center_40%]"
              />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#e2c275]">Multi-colour filament prints</h3>
              <p className="mt-3 font-sans leading-relaxed text-gray-300">
                Several filaments in one print. The swaps run through the height of the portrait, so the colour is in the plastic.
              </p>
            </div>
          </article>
          <article className="grid items-center gap-6 md:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 md:order-2">
              <Image
                src="/images/1F382F41-E88E-4192-815E-756C3A653F2D_1_105_c.jpeg"
                alt="Close view of printed commander portraits on deck box sides"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover object-[center_36%]"
              />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#e2c275]">HueForge-quality detail</h3>
              <p className="mt-3 font-sans leading-relaxed text-gray-300">
                The portrait is built the HueForge way. Filament swaps through the thickness, and each colour blends by its transmission distance, so highlights and shadows read in the layers.
              </p>
            </div>
          </article>
          <article className="grid items-center gap-6 md:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
              <Image
                src="/images/19C48FF5-CF48-4199-9D53-A6DB3112BDC8_1_105_c.jpeg"
                alt="Deck boxes with a commander card in the front window"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover object-[center_42%]"
              />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-[#e2c275]">Made for Commander</h3>
              <p className="mt-3 font-sans leading-relaxed text-gray-300">
                The front holds the commander. The same art continues around the sides of the box.
              </p>
            </div>
          </article>
        </div>
      </section>

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
    </div>
  );
}
