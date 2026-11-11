'use client';

import { useCart } from '../lib/useCart';

export default function CartPage() {
  const { items, removeItem, clearCart } = useCart();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] p-8 text-white">
      <h1 className="mb-4 text-3xl font-bold">Your Cart</h1>
      {items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="rounded-md bg-gray-800 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p>Quantity: {item.quantity}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-red-400 hover:text-red-200"
                  >
                    Remove
                  </button>
                </div>
                {item.images.some(Boolean) && (
                  <div className="mt-3 flex gap-2">
                    {item.images.filter(Boolean).map((src, index) => (
                      <img
                        key={index}
                        src={src}
                        alt=""
                        className="h-20 w-14 rounded bg-black/40 object-cover"
                      />
                    ))}
                  </div>
                )}
                {item.filamentLayers && (
                  <div className="mt-3">
                    <p className="text-sm text-[#e2c275]">Filament stack, bottom to top</p>
                    <ol className="mt-2 space-y-1 text-sm text-gray-200">
                      {item.filamentLayers.layers.map((layer, index) => {
                        const min = index === 0 ? 0 : item.filamentLayers!.boundaries[index - 1];
                        const max = index === item.filamentLayers!.layers.length - 1
                          ? 1
                          : item.filamentLayers!.boundaries[index];
                        return (
                          <li key={`${item.id}-${index}`} className="flex items-center gap-2">
                            <span
                              className="inline-block h-3 w-3 rounded-sm border border-white/30"
                              style={{ backgroundColor: layer.hex }}
                            />
                            <span>
                              {index + 1}. {layer.name}
                              <span className="text-gray-400">
                                {' '}· TD {layer.td}
                                {layer.approximate ? ' (approx)' : ''}
                                {layer.inStock ? '' : ' · out of stock'}
                                {min !== undefined && max !== undefined
                                  ? ` · luminance ${Math.round(min * 100)}–${Math.round(max * 100)}%`
                                  : ''}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={clearCart}
            className="mt-6 rounded bg-red-600 px-4 py-2 hover:bg-red-500"
          >
            Clear Cart
          </button>
        </>
      )}
    </div>
  );
}
