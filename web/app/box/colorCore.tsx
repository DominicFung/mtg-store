'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Filament, filamentsAreApproximate } from '../lib/filamentCatalogue';
import {
  colorAtLayer,
  clampStops,
  formatSwapDepth,
  hexToRgb,
  insertStop,
  layerTopMm,
  moveStop,
  removeStop,
  type CoreStop,
  type LayerSettings,
} from '../lib/hueforge';

type DragState = { kind: 'filament'; id: string };

type Props = {
  filaments: Filament[];
  source: 'api' | 'mock';
  layers: Filament[];
  stops: number[];
  layerCount: number;
  settings: LayerSettings;
  onChange: (layers: Filament[], stops: number[]) => void;
};

function finishLabel(finish: Filament['finish']): string {
  if (!finish || finish === 'standard') return 'PLA';
  return finish;
}

function toStops(layers: Filament[], endLayers: number[]): CoreStop[] {
  return layers.map((layer, index) => ({
    filament: { type: layer.type, brand: layer.brand, name: layer.name, td: layer.td },
    rgb: hexToRgb(layer.hex),
    endLayer: endLayers[index] ?? endLayers[endLayers.length - 1] ?? 1,
  }));
}

export default function ColorCore({
  filaments,
  source,
  layers,
  stops,
  layerCount,
  settings,
  onChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragStop = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ name: string; hex: string; x: number; y: number } | null>(null);

  const safeStops = useMemo(() => clampStops(stops, layerCount), [stops, layerCount]);
  const core = useMemo(() => toStops(layers, safeStops), [layers, safeStops]);
  const colors = useMemo(
    () => Array.from({ length: layerCount }, (_, index) => colorAtLayer(index + 1, core, settings)),
    [core, layerCount, settings],
  );
  const gradient = useMemo(() => {
    const bands = colors.map((color, index) => {
      const start = (index / layerCount) * 100;
      const end = ((index + 1) / layerCount) * 100;
      const rgb = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      return `${rgb} ${start.toFixed(2)}%, ${rgb} ${end.toFixed(2)}%`;
    });
    return `linear-gradient(to top, ${bands.join(', ')})`;
  }, [colors, layerCount]);

  const approximate = filamentsAreApproximate(filaments);
  const selected = filaments.find((filament) => filament.id === selectedId) ?? null;

  const commit = (nextLayers: Filament[], nextStops: number[]) => {
    onChange(nextLayers, clampStops(nextStops, layerCount));
  };

  const assign = (index: number, filament: Filament) => {
    const next = layers.slice();
    next[index] = filament;
    commit(next, safeStops);
  };

  const addStop = () => {
    const inserted = insertStop(safeStops);
    if (inserted.index < 0) return;
    const filament = filaments.find((item) => !layers.some((layer) => layer.id === item.id)) ?? filaments[0];
    if (!filament) return;
    const nextLayers = layers.slice();
    nextLayers.splice(inserted.index, 0, filament);
    commit(nextLayers, inserted.stops);
  };

  const deleteStop = (index: number) => {
    if (layers.length <= 1) return;
    commit(
      layers.filter((_, layerIndex) => layerIndex !== index),
      removeStop(safeStops, index),
    );
  };

  const layerFromClientY = (clientY: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return null;
    const fromTop = (clientY - rect.top) / rect.height;
    const fromBottom = 1 - fromTop;
    return Math.min(layerCount, Math.max(1, Math.round(fromBottom * layerCount)));
  };

  const onTouchDragStart = (event: React.PointerEvent, filament: Filament) => {
    if (event.pointerType === 'mouse') return;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setGhost(null);
      setOverIndex(null);
    };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < 12) return;
        dragging = true;
        suppressClick.current = true;
      }
      setGhost({ name: filament.name, hex: filament.hex, x: ev.clientX, y: ev.clientY });
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = target?.closest('[data-stop-index]');
      setOverIndex(row ? Number(row.getAttribute('data-stop-index')) : null);
    };
    const up = (ev: PointerEvent) => {
      if (dragging) {
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = target?.closest('[data-stop-index]');
        const index = row ? Number(row.getAttribute('data-stop-index')) : Number.NaN;
        if (Number.isInteger(index)) assign(index, filament);
      }
      end();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#e2c275]">Colour core</h3>
        <p className="mt-1 text-sm text-gray-300">
          {layerCount} layers, from the base up to the top slider. Drag a stop to choose where that filament ends. Brighter parts of the picture print taller, so they show the colours higher in the core.
        </p>
        {approximate && (
          <p className="mt-2 text-xs text-amber-200/90">
            Swatch colours and transmission distances are estimates from the shop list. A measured spool will change the blend.
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {source === 'mock'
            ? 'Sample catalogue for this preview. It switches to the shop list when AppSync is configured.'
            : 'Loaded from the shop filament catalogue.'}
        </p>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex shrink-0 items-stretch gap-2">
          <div
            ref={barRef}
            className="relative h-[28rem] w-14 touch-none rounded-md border border-cyan-300/80"
            style={{ backgroundImage: gradient }}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('[data-stop-handle]')) return;
              const layer = layerFromClientY(event.clientY);
              if (layer === null || safeStops.length === 0) return;
              let closest = 0;
              let distance = Infinity;
              safeStops.forEach((stop, index) => {
                const gap = Math.abs(stop - layer);
                if (gap < distance) {
                  distance = gap;
                  closest = index;
                }
              });
              dragStop.current = closest;
              event.currentTarget.setPointerCapture(event.pointerId);
              commit(layers, moveStop(safeStops, closest, layer, layerCount));
            }}
            onPointerMove={(event) => {
              if (dragStop.current === null || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const layer = layerFromClientY(event.clientY);
              if (layer === null) return;
              commit(layers, moveStop(safeStops, dragStop.current, layer, layerCount));
            }}
            onPointerUp={() => {
              dragStop.current = null;
            }}
          >
            {safeStops.map((stop, index) => (
              <div
                key={`${layers[index]?.id ?? 'stop'}-${index}`}
                data-stop-handle
                role="slider"
                tabIndex={0}
                aria-label={`${layers[index]?.name ?? 'Filament'} ends at layer ${stop}`}
                aria-valuemin={1}
                aria-valuemax={layerCount}
                aria-valuenow={stop}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                  event.preventDefault();
                  commit(layers, moveStop(safeStops, index, stop + (event.key === 'ArrowUp' ? 1 : -1), layerCount));
                }}
                className="absolute left-1/2 z-10 w-16 -translate-x-1/2 -translate-y-1/2"
                style={{ bottom: `${(stop / layerCount) * 100}%` }}
              >
                <span className="mx-auto block h-3 w-3 rounded-full border-2 border-[#1a1a2e] bg-white shadow" />
              </div>
            ))}
          </div>
          <div className="relative h-[28rem] w-16 text-[10px] text-gray-300">
            {safeStops.map((stop, index) => (
              <span
                key={`label-${index}`}
                className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                style={{ bottom: `${(stop / layerCount) * 100}%` }}
              >
                {stop}
                <span className="block text-gray-500">{formatSwapDepth(stop, settings)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-gray-400">Printed first at the top of this list</p>
            <button
              type="button"
              onClick={addStop}
              disabled={layers.length >= layerCount}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#e2c275]/50 px-3 text-xs text-[#e2c275] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add stop
            </button>
          </div>
          <ol className="max-h-[24rem] space-y-2 overflow-y-auto pr-1">
            {layers.map((filament, modelIndex) => {
              const endLayer = safeStops[modelIndex];
              return (
                <li
                  key={`${filament.id}-${modelIndex}`}
                  data-stop-index={modelIndex}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setOverIndex(modelIndex);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const filamentId = event.dataTransfer.getData('application/x-filament-id')
                      || (dragRef.current?.kind === 'filament' ? dragRef.current.id : '');
                    setOverIndex(null);
                    dragRef.current = null;
                    const picked = filaments.find((item) => item.id === filamentId);
                    if (picked) assign(modelIndex, picked);
                  }}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${
                    overIndex === modelIndex ? 'border-[#e2c275] bg-white/10' : 'border-white/10 bg-black/20'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (selected) assign(modelIndex, selected);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="h-8 w-8 shrink-0 rounded-sm border border-black/40" style={{ backgroundColor: filament.hex }} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{filament.name}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                        through layer {endLayer} · {layerTopMm(endLayer, settings).toFixed(2)} mm · TD {filament.td}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${filament.name}`}
                    disabled={layers.length <= 1}
                    onClick={() => deleteStop(modelIndex)}
                    className="grid h-11 w-11 place-items-center text-gray-300 disabled:opacity-30"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Palette</p>
        <div className="grid grid-cols-2 gap-2">
          {filaments.map((filament) => {
            const active = filament.id === selectedId;
            return (
              <button
                key={filament.id}
                type="button"
                draggable
                title={`${filament.name}. TD ${filament.td} mm. ${filament.inStock ? 'In stock' : 'Out of stock'}`}
                onClick={() => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  setSelectedId((current) => (current === filament.id ? null : filament.id));
                }}
                onPointerDown={(event) => onTouchDragStart(event, filament)}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-filament-id', filament.id);
                  event.dataTransfer.setData('text/plain', filament.name);
                  event.dataTransfer.effectAllowed = 'copy';
                  dragRef.current = { kind: 'filament', id: filament.id };
                }}
                onDragEnd={() => {
                  dragRef.current = null;
                  setOverIndex(null);
                }}
                className={`flex min-h-11 touch-manipulation items-center gap-2 rounded-md border px-2 py-1.5 text-left ${
                  active ? 'border-[#e2c275] bg-white/10' : 'border-white/10 bg-black/20 hover:border-white/30'
                } ${filament.inStock ? '' : 'opacity-60'}`}
              >
                <span className="h-8 w-8 shrink-0 rounded-sm border border-black/40" style={{ backgroundColor: filament.hex }} />
                <span className="min-w-0">
                  <span className="block text-xs leading-snug">{filament.name}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                    {(filament.type ?? 'PLA')} · {finishLabel(filament.finish)} · TD {filament.td}
                    {filament.inStock ? '' : ' · out'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {selected && <p className="mt-2 text-xs text-[#e2c275]">Tap a range to use {selected.name}.</p>}
      </div>
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-md border border-[#e2c275] bg-[#1a1a2e] px-2 py-1 text-xs shadow-lg"
          style={{ left: ghost.x + 12, top: ghost.y + 12 }}
        >
          <span className="h-4 w-4 rounded-sm" style={{ backgroundColor: ghost.hex }} />
          {ghost.name}
        </div>
      )}
    </div>
  );
}
