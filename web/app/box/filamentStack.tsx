'use client';

import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';
import { Filament, filamentsAreApproximate } from '../lib/filamentCatalogue';
import { boundariesAfterAdd, boundariesAfterRemove, hexToRgb, stackGradient } from '../lib/hueforge';

const MAX_LAYERS = 6;
const MIN_LAYERS = 2;
const BOUNDARY_GAP = 0.03;

type DragState = { kind: 'filament'; id: string } | { kind: 'layer'; index: number };

type Props = {
  filaments: Filament[];
  source: 'api' | 'mock';
  layers: Filament[];
  boundaries: number[];
  onChange: (layers: Filament[], boundaries: number[]) => void;
};

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function finishLabel(finish: Filament['finish']): string {
  if (!finish || finish === 'standard') return 'PLA';
  return finish;
}

export default function FilamentStack({ filaments, source, layers, boundaries, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragBoundary = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const [ghost, setGhost] = useState<{ name: string; hex: string; x: number; y: number } | null>(null);

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
        if (Math.abs(dy) > Math.abs(dx) + 4) {
          end();
          return;
        }
        dragging = true;
        suppressClick.current = true;
      }
      setGhost({ name: filament.name, hex: filament.hex, x: ev.clientX, y: ev.clientY });
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = target?.closest('[data-layer-index]');
      setOverIndex(row ? Number(row.getAttribute('data-layer-index')) : null);
    };
    const up = (ev: PointerEvent) => {
      if (dragging) {
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        const row = target?.closest('[data-layer-index]');
        const index = row ? Number(row.getAttribute('data-layer-index')) : Number.NaN;
        if (Number.isInteger(index)) assign(index, filament);
      }
      end();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const colors = layers.map((layer) => hexToRgb(layer.hex));
  const distances = layers.map((layer) => layer.td);
  const gradient = stackGradient(colors, distances, boundaries);
  const edges = [0, ...boundaries, 1];
  const approximate = filamentsAreApproximate(filaments);
  const selected = filaments.find((filament) => filament.id === selectedId) ?? null;

  const assign = (index: number, filament: Filament) => {
    const next = layers.slice();
    next[index] = filament;
    onChange(next, boundaries);
  };

  const moveLayer = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= layers.length || to >= layers.length) return;
    const next = layers.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next, boundaries);
  };

  const addLayer = () => {
    if (layers.length >= MAX_LAYERS) return;
    const filament = filaments.find((item) => !layers.some((layer) => layer.id === item.id)) ?? filaments[0];
    if (!filament) return;
    onChange([...layers, filament], boundariesAfterAdd(boundaries));
  };

  const removeLayer = (index: number) => {
    if (layers.length <= MIN_LAYERS) return;
    onChange(
      layers.filter((_, layerIndex) => layerIndex !== index),
      boundariesAfterRemove(boundaries, index, layers.length),
    );
  };

  const setBoundary = (index: number, value: number) => {
    const min = (boundaries[index - 1] ?? 0) + BOUNDARY_GAP;
    const max = (boundaries[index + 1] ?? 1) - BOUNDARY_GAP;
    const next = boundaries.slice();
    next[index] = round4(Math.min(max, Math.max(min, value)));
    onChange(layers, next);
  };

  const boundaryFromClientX = (index: number, clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setBoundary(index, (clientX - rect.left) / rect.width);
  };

  const nearestBoundary = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || boundaries.length === 0) return null;
    const position = (clientX - rect.left) / rect.width;
    let closest = 0;
    let distance = Infinity;
    boundaries.forEach((boundary, index) => {
      const gap = Math.abs(boundary - position);
      if (gap < distance) {
        distance = gap;
        closest = index;
      }
    });
    return closest;
  };

  const onDropLayer = (index: number, event: React.DragEvent) => {
    event.preventDefault();
    const filamentId = event.dataTransfer.getData('application/x-filament-id')
      || (dragRef.current?.kind === 'filament' ? dragRef.current.id : '');
    const fromRaw = event.dataTransfer.getData('application/x-layer-index');
    const layerDrag = fromRaw !== '' || dragRef.current?.kind === 'layer';
    const fromIndex = fromRaw !== ''
      ? Number(fromRaw)
      : dragRef.current?.kind === 'layer' ? dragRef.current.index : Number.NaN;
    setOverIndex(null);
    dragRef.current = null;
    if (filamentId) {
      const filament = filaments.find((item) => item.id === filamentId);
      if (filament) assign(index, filament);
      return;
    }
    if (layerDrag && Number.isInteger(fromIndex)) moveLayer(fromIndex, index);
  };

  const display = layers.map((layer, modelIndex) => ({ layer, modelIndex })).reverse();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#e2c275]">Filament layers</h3>
        <p className="mt-1 text-sm text-gray-300">
          Tap a colour, then tap a layer. You can also drag a spool onto a layer, and drag a layer onto another to reorder. On a phone, drag sideways from a colour onto a layer. The bottom layer is the opaque backing and shows in the shadows.
        </p>
        {approximate && (
          <p className="mt-2 text-xs text-amber-200/90">
            Swatch colours and transmission distances are approximate placeholders. Measure each spool and update the catalogue before relying on this preview for a print.
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">
          {source === 'mock'
            ? 'Sample catalogue for this preview. It switches to the shop list when AppSync is configured.'
            : 'Loaded from the shop filament catalogue.'}
        </p>
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
                title={`${filament.name}. Approximate TD ${filament.td} mm. ${filament.inStock ? 'In stock' : 'Out of stock'}`}
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
                <span
                  className="h-8 w-8 shrink-0 rounded-sm border border-black/40"
                  style={{ backgroundColor: filament.hex }}
                />
                <span className="min-w-0">
                  <span className="block text-xs leading-snug">{filament.name}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                    {finishLabel(filament.finish)} · TD {filament.td}
                    {filament.inStock ? '' : ' · out'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {selected && (
          <p className="mt-2 text-xs text-[#e2c275]">Click a layer to use {selected.name}.</p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">Shadow to highlight</p>
          <button
            type="button"
            onClick={addLayer}
            disabled={layers.length >= MAX_LAYERS}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-[#e2c275]/50 px-3 text-xs text-[#e2c275] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add layer
          </button>
        </div>
        <div
          ref={barRef}
          className="relative h-12 cursor-ew-resize touch-none"
          onPointerDown={(event) => {
            const index = nearestBoundary(event.clientX);
            if (index === null) return;
            dragBoundary.current = index;
            event.currentTarget.setPointerCapture(event.pointerId);
            boundaryFromClientX(index, event.clientX);
          }}
          onPointerMove={(event) => {
            if (dragBoundary.current === null || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
            boundaryFromClientX(dragBoundary.current, event.clientX);
          }}
          onPointerUp={() => {
            dragBoundary.current = null;
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-md border border-white/10"
            style={{ backgroundImage: gradient }}
          />
          {boundaries.map((boundary, index) => (
            <div
              key={index}
              role="slider"
              aria-label={`Boundary between ${layers[index]?.name ?? 'layer'} and ${layers[index + 1]?.name ?? 'layer'}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(boundary * 100)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                setBoundary(index, boundary + (event.key === 'ArrowRight' ? 0.02 : -0.02));
              }}
              className="pointer-events-none absolute top-0 h-full w-8 -translate-x-1/2"
              style={{ left: `${boundary * 100}%` }}
            >
              <span className="mx-auto block h-full w-0.5 bg-white shadow" />
              <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1a1a2e] bg-white shadow" />
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4">
          {layers.map((layer, index) => {
            const start = edges[index] ?? 0;
            const end = edges[index + 1] ?? 1;
            return (
              <span
                key={`${layer.id}-${index}`}
                className="absolute truncate text-[10px] text-gray-300"
                style={{
                  left: `${((start + end) / 2) * 100}%`,
                  transform: 'translateX(-50%)',
                  maxWidth: `${Math.max((end - start) * 100, 8)}%`,
                }}
              >
                {layer.name.replace(/^Elegoo |^Polyterra |^GiantArm /, '')}
              </span>
            );
          })}
        </div>
      </div>

      <ol className="space-y-2">
        {display.map(({ layer, modelIndex }) => {
          const highlighted = overIndex === modelIndex;
          return (
            <li
              key={`${layer.id}-${modelIndex}`}
              data-layer-index={modelIndex}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = dragRef.current?.kind === 'layer' ? 'move' : 'copy';
                setOverIndex(modelIndex);
              }}
              onDragLeave={() => setOverIndex((current) => (current === modelIndex ? null : current))}
              onDrop={(event) => onDropLayer(modelIndex, event)}
              className={`flex flex-wrap items-center gap-1 rounded-md border px-2 py-2 sm:flex-nowrap ${
                highlighted ? 'border-[#e2c275] bg-white/10' : 'border-white/10 bg-black/20'
              }`}
            >
              <button
                type="button"
                draggable
                aria-label={`Reorder ${layer.name}`}
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/x-layer-index', String(modelIndex));
                  event.dataTransfer.setData('text/plain', layer.name);
                  event.dataTransfer.effectAllowed = 'move';
                  dragRef.current = { kind: 'layer', index: modelIndex };
                }}
                onDragEnd={() => {
                  dragRef.current = null;
                  setOverIndex(null);
                }}
                className="cursor-grab text-gray-400 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selected) return;
                  assign(modelIndex, selected);
                }}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-sm border border-black/40"
                  style={{ backgroundColor: layer.hex }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{layer.name}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                    {modelIndex === 0 ? 'Backing · shadows' : modelIndex === layers.length - 1 ? 'Highlights' : 'Mid layer'}
                    {' · '}
                    {finishLabel(layer.finish)} · TD {layer.td}
                    {layer.inStock ? '' : ' · out of stock'}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`Move ${layer.name} toward highlights`}
                disabled={modelIndex === layers.length - 1}
                onClick={() => moveLayer(modelIndex, modelIndex + 1)}
                className="grid h-11 w-11 place-items-center text-gray-300 disabled:opacity-30"
              >
                <ChevronUp className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${layer.name} toward shadows`}
                disabled={modelIndex === 0}
                onClick={() => moveLayer(modelIndex, modelIndex - 1)}
                className="grid h-11 w-11 place-items-center text-gray-300 disabled:opacity-30"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${layer.name}`}
                disabled={layers.length <= MIN_LAYERS}
                onClick={() => removeLayer(modelIndex)}
                className="grid h-11 w-11 place-items-center text-gray-300 disabled:opacity-30"
              >
                <X className="h-5 w-5" />
              </button>
            </li>
          );
        })}
      </ol>
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
