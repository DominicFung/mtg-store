"use Client"

import { useCart } from '../lib/useCart';
import AppBar from '../components/appBar';

export default function CartPage() {
  const { items, removeItem, clearCart } = useCart();

  return (
    <>
      <div className="p-8 text-white">
        <h1 className="text-3xl font-bold mb-4">Your Cart</h1>
        {items.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <>
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="bg-gray-800 p-4 rounded-md flex justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    <p>Quantity: {item.quantity}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-red-400 hover:text-red-200"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={clearCart}
              className="mt-6 bg-red-600 px-4 py-2 rounded hover:bg-red-500"
            >
              Clear Cart
            </button>
          </>
        )}
      </div>
    </>
  );
}
