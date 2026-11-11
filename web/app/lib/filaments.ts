'use client';

import { useEffect, useState } from 'react';
import { Filament, MOCK_FILAMENTS, sortFilaments } from './filamentCatalogue';

const LIST_FILAMENTS = `query ListFilaments {
  listFilaments {
    id
    name
    hex
    td
    inStock
    brand
    material
    finish
    sortOrder
    approximate
  }
}`;

export type FilamentSource = 'api' | 'mock';

const FINISHES = new Set(['standard', 'matte', 'silk', 'pro', 'wood']);

function normalizeFilament(row: unknown): Filament | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.hex !== 'string') return null;
  const td = typeof item.td === 'number' ? item.td : Number(item.td);
  if (!Number.isFinite(td) || td < 0) return null;
  const sortOrder = typeof item.sortOrder === 'number' ? item.sortOrder : Number(item.sortOrder ?? 0);
  const finish = typeof item.finish === 'string' && FINISHES.has(item.finish)
    ? item.finish as Filament['finish']
    : null;
  return {
    id: item.id,
    name: item.name,
    hex: item.hex,
    td,
    inStock: item.inStock !== false,
    brand: typeof item.brand === 'string' ? item.brand : null,
    material: typeof item.material === 'string' ? item.material : null,
    finish,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    approximate: item.approximate !== false,
  };
}

export async function fetchFilaments(): Promise<{ filaments: Filament[]; source: FilamentSource }> {
  const url = process.env.NEXT_PUBLIC_APPSYNC_URL;
  const apiKey = process.env.NEXT_PUBLIC_APPSYNC_API_KEY;
  if (!url || !apiKey) return { filaments: MOCK_FILAMENTS, source: 'mock' };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ query: LIST_FILAMENTS }),
    });
    if (!response.ok) return { filaments: MOCK_FILAMENTS, source: 'mock' };
    const body = await response.json() as { data?: { listFilaments?: unknown } };
    const rows = body.data?.listFilaments;
    if (!Array.isArray(rows) || rows.length === 0) return { filaments: MOCK_FILAMENTS, source: 'mock' };
    const filaments = sortFilaments(rows.map(normalizeFilament).filter((filament): filament is Filament => filament !== null));
    if (filaments.length === 0) return { filaments: MOCK_FILAMENTS, source: 'mock' };
    return { filaments, source: 'api' };
  } catch {
    return { filaments: MOCK_FILAMENTS, source: 'mock' };
  }
}

export function useFilaments(): { filaments: Filament[]; source: FilamentSource } {
  const [state, setState] = useState<{ filaments: Filament[]; source: FilamentSource }>({
    filaments: MOCK_FILAMENTS,
    source: 'mock',
  });

  useEffect(() => {
    let cancelled = false;
    fetchFilaments().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
