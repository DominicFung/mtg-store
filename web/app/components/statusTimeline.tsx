'use client';

import { useEffect, useState } from 'react';
import { effectiveTimeline, formatToronto } from '../lib/statusTimeline';

export default function StatusTimeline({
  status,
  paymentStatus,
  createdAt,
  history,
}: {
  status: string;
  paymentStatus?: string;
  createdAt?: string;
  history?: Array<{ status: string; at: string; note?: string }>;
}) {
  const { stages, current } = effectiveTimeline({ status, paymentStatus, createdAt, history });
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setGrown(true);
      return;
    }
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [status, current]);
  const fill = stages.length <= 1 ? 100 : (current / (stages.length - 1)) * 100;

  return (
    <ol className="relative mt-4 grid grid-cols-1 gap-4 sm:grid-cols-5 sm:gap-2" aria-label="Order progress">
      <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-0.5 bg-white/15 sm:hidden" />
      <span
        aria-hidden
        className="absolute bottom-3 left-[7px] top-3 w-0.5 origin-top bg-[#e2c275] transition-transform duration-1000 ease-out motion-reduce:transition-none sm:hidden"
        style={{ transform: grown ? `scaleY(${fill / 100})` : 'scaleY(0)' }}
      />
      <span aria-hidden className="absolute left-4 right-4 top-[7px] hidden h-0.5 bg-white/15 sm:block" />
      <span
        aria-hidden
        className="absolute left-4 right-4 top-[7px] hidden h-0.5 origin-left bg-[#e2c275] transition-transform duration-1000 ease-out motion-reduce:transition-none sm:block"
        style={{ transform: grown ? `scaleX(${fill / 100})` : 'scaleX(0)' }}
      />
      {stages.map((stage, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'future';
        return (
          <li key={stage.id} className={`relative pl-8 sm:pl-0 sm:pt-8 ${state === 'future' ? 'text-gray-500' : 'text-white'}`}>
            <span
              className={`absolute left-0 top-1 h-4 w-4 rounded-full border-2 sm:left-1/2 sm:top-1 sm:-translate-x-1/2 ${
                state === 'future' ? 'border-white/20 bg-[#12182c]' : 'border-[#e2c275] bg-[#e2c275]'
              } ${state === 'current' ? 'ring-4 ring-[#e2c275]/30' : ''}`}
            />
            <p className={`text-sm font-semibold sm:text-center ${state === 'current' ? 'text-[#e2c275]' : ''}`}>{stage.label}</p>
            {stage.at && <p className="text-xs text-gray-400 sm:text-center">{formatToronto(stage.at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}
