'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../lib/useCart';

const linkClass = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-md px-2 text-sm sm:px-3 ${
    active ? 'text-[#e2c275]' : 'text-gray-100 hover:text-[#e2c275]'
  }`;

export default function AppBar() {
  const { items } = useCart();
  const path = usePathname();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-[#e2c275]/25 bg-[#1a1a2e]/95 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/logo-mark.png"
            alt=""
            width={44}
            height={44}
            priority
            className="h-9 w-9 shrink-0 rounded-full sm:h-11 sm:w-11"
          />
          <span className="truncate font-serif text-base font-bold tracking-wide text-[#e2c275] sm:text-xl">
            <span className="sm:hidden">Mana Ramp</span>
            <span className="hidden sm:inline">The Mana Ramp</span>
          </span>
        </Link>
        <nav aria-label="Shop" className="flex shrink-0 items-center">
          <Link href="/box" className={linkClass(path.startsWith('/box'))} aria-current={path.startsWith('/box') ? 'page' : undefined}>
            <span className="sm:hidden">Deck Box</span>
            <span className="hidden sm:inline">Commander Deck Box</span>
          </Link>
          <Link href="/track" className={linkClass(path.startsWith('/track'))} aria-current={path.startsWith('/track') ? 'page' : undefined}>
            Track
          </Link>
          <Link
            href="/cart"
            aria-label={count > 0 ? `Cart, ${count} items` : 'Cart'}
            aria-current={path.startsWith('/cart') ? 'page' : undefined}
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-100 hover:text-[#e2c275]"
          >
            <ShoppingCart className="h-6 w-6" />
            {count > 0 && (
              <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
