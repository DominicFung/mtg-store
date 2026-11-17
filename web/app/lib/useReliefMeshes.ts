'use client';

import { useEffect, useState } from 'react';
import type { Filament } from './filamentCatalogue';
import type { PrintSettings } from './printGeometry';
import { toCoreStops } from './renderLayers';
import { buildReliefBatch, type ReliefBuffers } from './reliefClient';

const EMPTY: Array<ReliefBuffers | null> = [null, null, null];

async function raster(src: string): Promise<{ rgba: Uint8Array; width: number; height: number } | null> {
  if (!src) return null;
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  return { rgba: new Uint8Array(pixels), width: canvas.width, height: canvas.height };
}

export function useReliefMeshes(
  crops: readonly [string, string, string],
  layers: readonly Filament[],
  stops: readonly number[],
  settings: PrintSettings,
  enabled: boolean,
): { meshes: Array<ReliefBuffers | null>; pending: boolean } {
  const [meshes, setMeshes] = useState<Array<ReliefBuffers | null>>(EMPTY);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!enabled || !crops[0] || layers.length === 0) {
      setMeshes(EMPTY);
      setPending(false);
      return undefined;
    }
    let cancelled = false;
    setPending(true);
    const timer = window.setTimeout(() => {
      const coreStops = toCoreStops(layers, stops);
      Promise.all(crops.map((src) => raster(src))).then((rasters) => {
        if (cancelled) return;
        if (rasters.some((rasterized) => !rasterized)) {
          setPending(false);
          return;
        }
        const ready = rasters as Array<{ rgba: Uint8Array; width: number; height: number }>;
        return buildReliefBatch(ready.map((face) => ({
          rgba: face.rgba,
          imageWidth: face.width,
          imageHeight: face.height,
          settings,
          stops: coreStops,
          maxTriangles: 60_000,
        }))).then((surfaces) => {
          if (cancelled) return;
          setMeshes(surfaces);
          setPending(false);
        });
      }).catch(() => {
        if (!cancelled) setPending(false);
      });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [crops, layers, stops, settings, enabled]);

  return { meshes, pending };
}
