'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { trackOrder, type ShopOrder } from '../lib/shopOrders';
import LidSummary from '../components/lidSummary';

export default function TrackClient() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [order, setOrder] = useState<ShopOrder | null>(null);
  const [error, setError] = useState('');

  const lookup = async (number: string, mail: string) => {
    setError('');
    setOrder(null);
    try {
      const found = await trackOrder(number, mail);
      if (!found) setError('No order matches that number and email.');
      else setOrder(found);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not look up the order');
    }
  };

  useEffect(() => {
    const number = params.get('order');
    const mail = params.get('email');
    if (number && mail) void lookup(number, mail);
  }, [params]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void lookup(orderNumber, email);
  };

  return (
    <main className="min-h-full bg-gradient-to-b from-[#1a1a2e] to-[#16213e] px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold text-[#e2c275]">Track a Commander Deck Box</h1>
        <p className="mt-2 text-sm text-gray-300">Use the order number from the receipt and the email you ordered with. The number alone is not enough.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label className="block text-xs text-gray-400" htmlFor="track-order">Order number
            <input id="track-order" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-sm" />
          </label>
          <label className="block text-xs text-gray-400" htmlFor="track-email">Email
            <input id="track-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-sm" />
          </label>
          <button type="submit" className="min-h-11 rounded-md bg-[#e2c275] px-4 text-sm font-semibold text-black">Look up</button>
        </form>
        {error && <p className="mt-4 text-amber-200">{error}</p>}
        {order && (
          <article className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="font-mono text-xl text-[#e2c275]">{order.orderNumber}</p>
            <p className="mt-2">Status: {order.status.replaceAll('_', ' ').toLowerCase()}</p>
            {order.status === 'SHIPPED' && <p>{order.carrier} {order.trackingNumber}</p>}
            {order.status === 'FAILED' && <p className="text-sm text-amber-200">{order.errorMessage || 'The shop is looking at this order.'}</p>}
            <ol className="mt-3 space-y-1 text-sm text-gray-300">
              {order.history.map((entry, index) => (
                <li key={`${entry.at}-${index}`}>{entry.at.slice(0, 16).replace('T', ' ')} · {entry.status.replaceAll('_', ' ').toLowerCase()}{entry.note ? ` · ${entry.note}` : ''}</li>
              ))}
            </ol>
            {order.lid && <div className="mt-3"><LidSummary lid={order.lid} /></div>}
            {order.previews.some(Boolean) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {order.previews.map((src, index) => src ? <img key={index} src={src} alt="" className="w-full rounded" /> : null)}
              </div>
            )}
          </article>
        )}
      </div>
    </main>
  );
}
