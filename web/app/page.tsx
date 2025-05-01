import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import manaBackground from './assets/mana-bg.png'; // Make sure this path is correct
import logo from './assets/mana-ramp-logo.png'; // Optional logo
import ProductCard from './productCard';

const products = [
  {
    name: 'Custom Deck Box',
    description: 'Upload your art and create a unique deck box.',
    link: '/box',
    images: [
      '/images/1F382F41-E88E-4192-815E-756C3A653F2D_1_105_c.jpeg', 
      '/images/19C48FF5-CF48-4199-9D53-A6DB3112BDC8_1_105_c.jpeg',
      '/images/1801181C-5A70-41EF-BFDA-E37758F04E91_1_105_c.jpeg',
      '/images/B24D1D86-3792-46B5-A4F6-51A094D4A847_1_105_c.jpeg'
    ]
  },
  {
    name: 'Mana Token Set',
    description: 'Premium resin tokens for each mana color.',
    link: '/tokens',
    images: ['/images/mana-tokens-thumbnail.jpg']
  },
  {
    name: 'Commander Life Counter',
    description: 'Track your life total with style.',
    link: '/life-counter',
    images: ['/images/life-counter-thumbnail.jpg']
  },
];

export default function FrontPage() {
  return (
    <div
      className="min-h-screen bg-cover bg-center text-white font-serif p-8"
      style={{ backgroundImage: `url(${manaBackground})` }}
    >
      <div className="flex flex-col items-center mb-12">
        {logo && (
          <Image
            src={logo}
            alt="The Mana Ramp Logo"
            className="w-32 h-32 mb-4 rounded-full shadow-lg"
          />
        )}

        <h1 className="text-5xl font-bold text-[#e2c275] mb-2 drop-shadow-lg">The Mana Ramp</h1>
        <p className="text-lg text-gray-200 italic text-center max-w-xl">
          3D-printed accessories for Magic: The Gathering players
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {products.map((product) => (
          <ProductCard key={product.name} product={product} />
        ))}
      </div>

      <div className="absolute top-4 right-4 text-sm text-gray-300">
        <p className="italic">Made by Planeswalkers, for Planeswalkers</p>
      </div>
    </div>
  );
}