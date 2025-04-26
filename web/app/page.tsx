import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

import manaBackground from './assets/mana-bg.png'; // Make sure this path is correct
import logo from './assets/mana-ramp-logo.png'; // Optional logo

const products = [
  {
    name: 'Custom Deck Box',
    description: 'Upload your art and create a unique deck box.',
    link: '/box',
    image: '/images/deck-box-thumbnail.jpg',
  },
  {
    name: 'Mana Token Set',
    description: 'Premium resin tokens for each mana color.',
    link: '/tokens',
    image: '/images/mana-tokens-thumbnail.jpg',
  },
  {
    name: 'Commander Life Counter',
    description: 'Track your life total with style.',
    link: '/life-counter',
    image: '/images/life-counter-thumbnail.jpg',
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
          <Link href={product.link} key={product.name}>
            <div className="bg-gray-900 bg-opacity-70 p-4 rounded-xl shadow-lg hover:scale-105 transition transform">
              <Image
                src={product.image}
                alt={product.name}
                width={400} // or whatever size you want
                height={300}
                className="w-full h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="text-xl text-[#e2c275] font-semibold mb-2">{product.name}</h3>
              <p className="text-gray-300 text-sm">{product.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="absolute top-4 right-4 text-sm text-gray-300">
        <p className="italic">Made by Planeswalkers, for Planeswalkers</p>
      </div>
    </div>
  );
}