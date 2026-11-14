'use client';

import { useEffect, useRef, useState } from 'react';
import type { ExtendSide, SubjectBounds } from '../../../packages/print-core/src/outpaint';
import { outpaintArt } from '../lib/shopOrders';

type CardHit = {
  id: string;
  name: string;
  art: string;
};

type Artwork = {
  src: string;
  name: string;
  artUrl: string;
  side: ExtendSide;
  subject: SubjectBounds;
  source: string;
};

type Props = {
  onArtwork: (artwork: Artwork) => void;
};

const SCRYFALL_PAUSE_MS = 150;

export default function CommanderSearch({ onArtwork }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CardHit[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const name = query.trim();
    if (name.length < 2) {
      setHits([]);
      setStatus('');
      return;
    }
    const handle = window.setTimeout(() => {
      void search(name);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [query]);

  const search = async (name: string) => {
    const id = requestId.current + 1;
    requestId.current = id;
    setBusy(true);
    setStatus('Searching Scryfall…');
    try {
      await wait(SCRYFALL_PAUSE_MS);
      const names = await autocomplete(name);
      if (id !== requestId.current) return;
      if (names.length === 0) {
        setHits([]);
        setStatus('No commander by that name.');
        return;
      }
      await wait(SCRYFALL_PAUSE_MS);
      const cards = await collection(names.map(frontFaceName));
      if (id !== requestId.current) return;
      const next = cards.map(toHit).filter((hit): hit is CardHit => hit !== null).slice(0, 8);
      setHits(next);
      setStatus(next.length ? '' : 'No commander by that name.');
    } catch (error) {
      if (id !== requestId.current) return;
      setHits([]);
      setStatus(error instanceof Error ? error.message : 'Scryfall is unavailable');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };

  const choose = async (hit: CardHit) => {
    const id = requestId.current + 1;
    requestId.current = id;
    setBusy(true);
    setStatus(`Extending ${hit.name} to the box…`);
    try {
      const extended = await outpaintArt(hit.art);
      if (id !== requestId.current) return;
      onArtwork({
        src: extended.image,
        name: hit.name,
        artUrl: hit.art,
        side: extended.side,
        subject: extended.subject,
        source: extended.source,
      });
      setStatus(extended.source === 'edge-extend'
        ? 'Extended on one side to the three-face frame.'
        : extended.source === 'cache'
          ? 'Loaded the saved extension.'
          : 'Extended with Stability on Amazon Bedrock.');
    } catch (error) {
      if (id !== requestId.current) return;
      setStatus(error instanceof Error ? error.message : 'Could not extend the artwork');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };

  return (
    <div>
      <label className="block text-sm text-gray-300" htmlFor="commander-search">Commander</label>
      <input
        id="commander-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search legendary creatures"
        autoComplete="off"
        className="mt-1 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-sm"
      />
      <p className="mt-1 text-xs text-gray-500">Commander-legal cards only. Scryfall requests are spaced so we stay under their rate limit.</p>
      {status && <p className="mt-2 text-sm text-[#e2c275]">{status}</p>}
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => { void choose(hit); }}
              disabled={busy}
              className="w-full overflow-hidden rounded-lg border border-white/10 bg-black/30 text-left disabled:opacity-60"
            >
              <img src={hit.art} alt="" className="aspect-[5/4] w-full object-cover" />
              <span className="block truncate px-2 py-2 text-xs">{hit.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Autocomplete answers partial names with 200 and an empty list. /cards/search
 * answers the same miss with 404, which is what the console was showing for
 * `?unique=cards` while a name was still being typed.
 */
async function autocomplete(name: string): Promise<string[]> {
  const response = await fetch(
    `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(name)}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error(`Scryfall returned ${response.status}`);
  const body = await response.json() as { data?: string[] };
  return (body.data ?? []).slice(0, 20);
}

function frontFaceName(name: string): string {
  // Scryfall's collection route does not resolve the combined "A // B" name.
  return name.split(' // ')[0]?.trim() || name;
}

async function collection(names: string[]): Promise<Array<Record<string, unknown>>> {
  const identifiers = [...new Set(names)].map((name) => ({ name }));
  const response = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifiers }),
  });
  if (!response.ok) throw new Error(`Scryfall returned ${response.status}`);
  const body = await response.json() as { data?: Array<Record<string, unknown>> };
  return (body.data ?? []).filter(canBeCommander);
}

function canBeCommander(card: Record<string, unknown>): boolean {
  const types = typeLines(card);
  if (types.some((type) => /legendary/i.test(type) && /creature/i.test(type))) return true;
  return oracleTexts(card).some((text) => /can be your commander/i.test(text));
}

function typeLines(card: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (typeof card.type_line === 'string') lines.push(card.type_line);
  const faces = card.card_faces;
  if (Array.isArray(faces)) {
    for (const face of faces) {
      if (face && typeof face === 'object') {
        const type = (face as Record<string, unknown>).type_line;
        if (typeof type === 'string') lines.push(type);
      }
    }
  }
  return lines;
}

function oracleTexts(card: Record<string, unknown>): string[] {
  const lines: string[] = [];
  if (typeof card.oracle_text === 'string') lines.push(card.oracle_text);
  const faces = card.card_faces;
  if (Array.isArray(faces)) {
    for (const face of faces) {
      if (face && typeof face === 'object') {
        const text = (face as Record<string, unknown>).oracle_text;
        if (typeof text === 'string') lines.push(text);
      }
    }
  }
  return lines;
}

function toHit(card: Record<string, unknown>): CardHit | null {
  const id = typeof card.id === 'string' ? card.id : '';
  const name = typeof card.name === 'string' ? card.name : '';
  const art = artUrl(card);
  if (!id || !name || !art) return null;
  return { id, name, art };
}

function artUrl(card: Record<string, unknown>): string {
  const direct = imageUris(card.image_uris);
  if (direct) return direct;
  const faces = card.card_faces;
  if (Array.isArray(faces)) {
    for (const face of faces) {
      if (face && typeof face === 'object') {
        const found = imageUris((face as Record<string, unknown>).image_uris);
        if (found) return found;
      }
    }
  }
  return '';
}

function imageUris(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const uris = value as Record<string, unknown>;
  return typeof uris.art_crop === 'string' ? uris.art_crop : '';
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
