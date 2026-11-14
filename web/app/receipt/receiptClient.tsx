'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { trackOrder, type ShopOrder } from '../lib/shopOrders';

export default function ReceiptClient() {
  const params = useSearchParams();
  const orderNumber = params.get('order') ?? '';
  const email = params.get('email') ?? '';
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderNumber || !email) return;
    trackOrder(orderNumber, email).then((found) => {
      if (!found) setError('That order was not found for this email.');
      else setOrder(found);
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not load the receipt');
    });
  }, [orderNumber, email]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#1a1a2e] to-[#16213e] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-[#e2c275]">The Mana Ramp</p>
        <h1 className="mt-1 text-3xl font-bold">Commander Deck Box receipt</h1>
        {error && <p className="mt-4 text-amber-200">{error}</p>}
        {order && (
          <article className="mt-6 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-6">
            <p className="text-sm text-gray-400">Order number</p>
            <p className="font-mono text-2xl text-[#e2c275]">{order.orderNumber}</p>
            <p>{order.name} · {order.email}</p>
            <p>Status <span className="text-[#e2c275]">{label(order.status)}</span></p>
            <p>Price <span className="text-[#e2c275]">{order.priceLabel}</span></p>
            <p className="text-xs text-gray-500">Payment is not collected in the shop yet. {order.paymentStatus === 'NOT_CONNECTED' ? 'Pay when the shop confirms the print.' : order.paymentStatus}</p>
            <p className="text-sm">{order.profileName} nozzle · {order.layerCount} colour layers</p>
            {order.previews.some(Boolean) && (
              <div className="grid grid-cols-3 gap-2">
                {order.previews.map((src, index) => (
                  src ? <img key={index} src={src} alt={`Face ${index + 1}`} className="w-full rounded bg-black/40" /> : null
                ))}
              </div>
            )}
            {order.stops.length > 0 && (
              <ol className="space-y-1 text-sm">
                {order.stops.map((stop) => (
                  <li key={`${stop.filamentId}-${stop.endLayer}`} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: stop.hex }} />
                    {stop.name} through layer {stop.endLayer}
                  </li>
                ))}
              </ol>
            )}
            <Link className="inline-flex min-h-11 items-center text-[#e2c275] underline" href={`/track?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.email)}`}>
              Track this order
            </Link>
          </article>
        )}
      </div>
    </main>
  );
}

function label(status: string) {
  return status.replaceAll('_', ' ').toLowerCase();
}
