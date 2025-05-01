"use client"

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Product = {
  name: string;
  description: string;
  link: string;
  images: string[];
};

type ProductCardProps = {
  product: Product;
};

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const imageCount = product.images.length;

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % imageCount);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + imageCount) % imageCount);
  };

  useEffect(() => {
    if (!isHovered) {
      intervalRef.current = setInterval(nextImage, 3000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered]);

  return (
    <Link href={product.link}>
      <div
        className="relative bg-gray-900 bg-opacity-70 p-4 rounded-xl shadow-lg hover:scale-105 transition transform"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative">
          <Image
            src={product.images[currentIndex]}
            alt={`${product.name} image ${currentIndex + 1}`}
            width={400}
            height={300}
            unoptimized // temporarily disables next/image optimizations
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
          {imageCount > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  prevImage();
                }}
                className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-80"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  nextImage();
                }}
                className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1 rounded-full hover:bg-opacity-80"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>
        <h3 className="text-xl text-[#e2c275] font-semibold mb-2">{product.name}</h3>
        <p className="text-gray-300 text-sm">{product.description}</p>
      </div>
    </Link>
  );
};

export default ProductCard;
