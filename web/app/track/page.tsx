import { Suspense } from 'react';
import TrackClient from './trackClient';

export const metadata = { title: 'Track a Commander Deck Box' };

export default function TrackPage() {
  return (
    <Suspense fallback={<p className="p-8 text-white">Loading tracking…</p>}>
      <TrackClient />
    </Suspense>
  );
}
