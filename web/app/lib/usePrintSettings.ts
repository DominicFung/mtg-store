'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_PRINT_SETTINGS, PrintSettings } from './printGeometry';

const GET_PRINT_SETTINGS = `query GetPrintSettings {
  getPrintSettings {
    id
    layerHeight
    baseLayerHeight
    width
    height
    nozzleSize
  }
}`;

export type PrintSettingsSource = 'api' | 'defaults';

function positive(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePrintSettings(row: unknown): PrintSettings | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  return {
    layerHeight: positive(item.layerHeight, DEFAULT_PRINT_SETTINGS.layerHeight),
    baseLayerHeight: positive(item.baseLayerHeight, DEFAULT_PRINT_SETTINGS.baseLayerHeight),
    width: positive(item.width, DEFAULT_PRINT_SETTINGS.width),
    height: positive(item.height, DEFAULT_PRINT_SETTINGS.height),
    nozzleSize: positive(item.nozzleSize, DEFAULT_PRINT_SETTINGS.nozzleSize),
  };
}

export async function fetchPrintSettings(): Promise<{ settings: PrintSettings; source: PrintSettingsSource }> {
  const url = process.env.NEXT_PUBLIC_APPSYNC_URL;
  const apiKey = process.env.NEXT_PUBLIC_APPSYNC_API_KEY;
  if (!url || !apiKey) return { settings: DEFAULT_PRINT_SETTINGS, source: 'defaults' };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ query: GET_PRINT_SETTINGS }),
    });
    if (!response.ok) return { settings: DEFAULT_PRINT_SETTINGS, source: 'defaults' };
    const body = await response.json() as { data?: { getPrintSettings?: unknown } };
    const settings = normalizePrintSettings(body.data?.getPrintSettings);
    if (!settings) return { settings: DEFAULT_PRINT_SETTINGS, source: 'defaults' };
    return { settings, source: 'api' };
  } catch {
    return { settings: DEFAULT_PRINT_SETTINGS, source: 'defaults' };
  }
}

export function usePrintSettings(): { settings: PrintSettings; source: PrintSettingsSource } {
  const [state, setState] = useState<{ settings: PrintSettings; source: PrintSettingsSource }>({
    settings: DEFAULT_PRINT_SETTINGS,
    source: 'defaults',
  });

  useEffect(() => {
    let cancelled = false;
    fetchPrintSettings().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
