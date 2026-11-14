import { Suspense } from 'react';
import ReceiptClient from './receiptClient';

export const metadata = { title: 'Commander Deck Box receipt' };

export default function ReceiptPage() {
  return (
    <Suspense fallback={<p className="p-8 text-white">Loading the receipt…</p>}>
      <ReceiptClient />
    </Suspense>
  );
}
