'use client';

import { useEffect, useState } from 'react';

type CardHit = {
  id: string;
  name: string;
  art: string;
};

import { outpaintArt } from '../lib/shopOrders';

type Props = {
  onArtwork: (src: string, name: string) => void;
};

const SCRYFALL_PAUSE_MS = 150;

export default function CommanderSearch({ onArtwork }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CardHit[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setStatus('Searching Scryfall…');
    try {
      await wait(SCRYFALL_PAUSE_MS);
      const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`is:commander ${name}`)}&unique=cards`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.status === 404) {
        setHits([]);
        setStatus('No commander by that name.');
        return;
      }
      if (!response.ok) throw new Error(`Scryfall returned ${response.status}`);
      const body = await response.json() as { data?: Array<Record<string, unknown>> };
      const next = (body.data ?? []).slice(0, 8).map(toHit).filter((hit): hit is CardHit => hit !== null);
      setHits(next);
      setStatus(next.length ? '' : 'No commander by that name.');
    } catch (error) {
      setHits([]);
      setStatus(error instanceof Error ? error.message : 'Scryfall is unavailable');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (hit: CardHit) => {
    setBusy(true);
    setStatus(`Extending ${hit.name} to the box…`);
    try {
      const extended = await outpaintArt(hit.art);
      onArtwork(extended.image, hit.name);
      setStatus(extended.source === 'edge-extend' ? 'Extended to the three-face frame.' : 'Extended with Stability on Amazon Bedrock.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not extend the artwork');
    } finally {
      setBusy(false);
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
      {status && <p className="mt-2 text-sm text-[#e2c275]">{busy ? status : status}</p>}
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
