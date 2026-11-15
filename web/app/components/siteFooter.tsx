import Image from 'next/image';
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#e2c275]/20 bg-[#10131c] text-gray-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <Image src="/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
            <p className="font-serif text-lg font-bold text-[#e2c275]">The Mana Ramp</p>
          </div>
          <p className="mt-3 text-sm italic text-gray-400">Made by Planeswalkers, for Planeswalkers</p>
        </div>
        <nav aria-label="Footer" className="flex flex-col text-sm">
          <Link href="/box" className="inline-flex min-h-11 items-center hover:text-[#e2c275]">Commander Deck Box</Link>
          <Link href="/track" className="inline-flex min-h-11 items-center hover:text-[#e2c275]">Track an order</Link>
          <Link href="/cart" className="inline-flex min-h-11 items-center hover:text-[#e2c275]">Cart</Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} The Mana Ramp</p>
          <Link href="/admin" className="inline-flex min-h-11 items-center text-gray-500 hover:text-gray-300 sm:min-h-0">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
