'use client';
import { createContext, useContext, useState, ReactNode } from 'react';
import type { FilamentLayerSettings } from './filamentCatalogue';

export type CartItem = {
  id: string;
  name: string;
  quantity: number;
  images: string[];
  filamentLayers?: FilamentLayerSettings;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function recipeKey(item: CartItem): string {
  if (!item.filamentLayers) return '';
  return JSON.stringify({
    ids: item.filamentLayers.layers.map((layer) => layer.id),
    boundaries: item.filamentLayers.boundaries.map((value) => Math.round(value * 1000) / 1000),
  });
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const key = recipeKey(item);
      const existing = prev.find((entry) => (
        item.filamentLayers
          ? entry.name === item.name && recipeKey(entry) === key
          : entry.id === item.id
      ));
      if (existing) {
        return prev.map((entry) => (
          entry === existing
            ? {
              ...entry,
              quantity: entry.quantity + item.quantity,
              images: item.images,
              filamentLayers: item.filamentLayers ?? entry.filamentLayers,
            }
            : entry
        ));
      }
      const id = prev.some((entry) => entry.id === item.id) ? `${item.id}-${Date.now()}` : item.id;
      return [...prev, { ...item, id }];
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};
