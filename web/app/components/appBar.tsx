'use client';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '../lib/useCart';

export default function AppBar() {
  const { items } = useCart();

  return (
    <header className="bg-[#1a1a2e] text-white shadow-md p-4 flex justify-between items-center">
      <Link href="/" className="text-2xl font-bold text-[#e2c275]">The Mana Ramp</Link>
      <Link href="/cart" className="relative">
        <ShoppingCart className="w-6 h-6" />
        {items.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-xs rounded-full w-5 h-5 text-center">
            {items.length}
          </span>
        )}
      </Link>
    </header>
  );
}