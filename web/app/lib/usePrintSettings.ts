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
    minDepth
    maxDepth
    borderWidth
    borderDepth
    detailSize
  }
}`;

const GET_PRINT_SETTINGS_LEGACY = `query GetPrintSettings {
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

function nonNegative(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
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
    minDepth: positive(item.minDepth, DEFAULT_PRINT_SETTINGS.minDepth),
    maxDepth: positive(item.maxDepth, DEFAULT_PRINT_SETTINGS.maxDepth),
    borderWidth: nonNegative(item.borderWidth, DEFAULT_PRINT_SETTINGS.borderWidth),
    borderDepth: positive(item.borderDepth, DEFAULT_PRINT_SETTINGS.borderDepth),
    detailSize: positive(item.detailSize, DEFAULT_PRINT_SETTINGS.detailSize),
  };
}

async function queryPrintSettings(query: string): Promise<PrintSettings | null> {
  const url = process.env.NEXT_PUBLIC_APPSYNC_URL;
  const apiKey = process.env.NEXT_PUBLIC_APPSYNC_API_KEY;
  if (!url || !apiKey) return null;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) return null;
  const body = await response.json() as { data?: { getPrintSettings?: unknown }; errors?: unknown[] };
  if (body.errors?.length) return null;
  return normalizePrintSettings(body.data?.getPrintSettings);
}

export async function fetchPrintSettings(): Promise<{ settings: PrintSettings; source: PrintSettingsSource }> {
  const url = process.env.NEXT_PUBLIC_APPSYNC_URL;
  const apiKey = process.env.NEXT_PUBLIC_APPSYNC_API_KEY;
  if (!url || !apiKey) return { settings: DEFAULT_PRINT_SETTINGS, source: 'defaults' };

  try {
    const current = await queryPrintSettings(GET_PRINT_SETTINGS);
    if (current) return { settings: current, source: 'api' };
    const legacy = await queryPrintSettings(GET_PRINT_SETTINGS_LEGACY);
    if (legacy) return { settings: legacy, source: 'api' };
    return { settings: DEFAULT_PRINT_SETTINGS, source: 'defaults' };
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
