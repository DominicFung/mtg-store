'use client';

import { BOX_FILAMENT_IDS } from '../../../packages/print-core/src/boxColours';
import { clampLidOpen } from '../../../packages/print-core/src/lidGeometry';
import { cleanLidText } from '../../../packages/print-core/src/lidText';
import { LID_MARKS, type LidMark } from '../../../packages/print-core/src/lidMarks';
import type { Filament } from '../lib/filamentCatalogue';

export const DEFAULT_BOX_FILAMENT_ID = 'elegoo-pla-black';
export const DEFAULT_LOGO_FILAMENT_ID = 'elegoo-pla-red';
export const DEFAULT_TEXT_FILAMENT_ID = 'deeplee-matte-white';

type Props = {
  filaments: Filament[];
  box: Filament | null;
  lockedLabel: string;
  markId: LidMark['id'];
  name: string;
  open: number;
  onMark: (id: LidMark['id']) => void;
  onName: (value: string) => void;
  onOpen: (value: number) => void;
};

export function boxFilamentChoices(filaments: Filament[]): Filament[] {
  const stock = filaments.filter((filament) => filament.inStock);
  return BOX_FILAMENT_IDS
    .map((id) => stock.find((filament) => filament.id === id))
    .filter((filament): filament is Filament => Boolean(filament));
}

export function filamentById(filaments: Filament[], id: string, fallbackId: string): Filament | null {
  const stock = filaments.filter((filament) => filament.inStock);
  return stock.find((filament) => filament.id === id)
    ?? stock.find((filament) => filament.id === fallbackId)
    ?? stock[0]
    ?? null;
}

export default function LidFinish({
  filaments,
  box,
  lockedLabel,
  markId,
  name,
  open,
  onMark,
  onName,
  onOpen,
}: Props) {
  const mark = LID_MARKS.find((entry) => entry.id === markId) ?? LID_MARKS[2];
  return (
    <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-semibold text-[#e2c275]" htmlFor="lid-slide">Slide the lid</label>
          <span className="text-xs text-gray-400">{open < 0.08 ? 'Closed' : open > 0.92 ? 'Open' : 'Sliding'}</span>
        </div>
        <input
          id="lid-slide"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(open * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(open * 100)}
          aria-valuetext={open < 0.08 ? 'Closed' : open > 0.92 ? 'Open' : `${Math.round(open * 100)} percent open`}
          onChange={(event) => onOpen(clampLidOpen(Number(event.target.value) / 100))}
          className="mt-2 h-11 w-full cursor-pointer accent-[#e2c275]"
        />
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-gray-500">
          <span>Closed</span>
          <span>Open</span>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-[#e2c275]">Box colour</legend>
        <p className="mt-1 text-xs text-gray-400">{lockedLabel}</p>
        {box && (
          <div className="mt-2 flex items-center gap-3">
            <span className="h-11 w-11 rounded-md border-2 border-[#e2c275]" style={{ backgroundColor: box.hex }} />
            <span className="text-sm">{box.name}</span>
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold text-[#e2c275]">Logo and name colour</legend>
        <p className="mt-1 text-xs text-gray-400">One choice colours the Magic logo and the raised name.</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Logo and name colour">
          {LID_MARKS.map((entry) => {
            const logo = filamentById(filaments, entry.logoFilamentId, entry.logoFilamentId);
            const text = filamentById(filaments, entry.textFilamentId, entry.textFilamentId);
            const active = entry.id === mark.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={entry.name}
                title={entry.detail}
                onClick={() => onMark(entry.id)}
                className={`h-11 w-11 rounded-md border-2 ${active ? 'border-[#e2c275]' : 'border-white/25'}`}
                style={entry.split
                  ? { background: `linear-gradient(to top right, ${text?.hex ?? '#F4F1EA'} 50%, ${logo?.hex ?? '#D4252B'} 50%)` }
                  : { backgroundColor: logo?.hex ?? '#F4F1EA' }}
              />
            );
          })}
        </div>
        <p className="mt-2 text-sm">{mark.name}. {mark.detail}.</p>
      </fieldset>
      <div>
        <label className="text-sm font-semibold text-[#e2c275]" htmlFor="lid-name">Name on the lid</label>
        <p className="mt-1 text-xs text-gray-400">Optional. Up to 20 characters. It prints raised, about 1 mm, in its own colour.</p>
        <input
          id="lid-name"
          value={name}
          maxLength={20}
          autoComplete="off"
          spellCheck={false}
          placeholder="Dom Fungus"
          onChange={(event) => onName(cleanLidText(event.target.value))}
          className="mt-2 min-h-11 w-full rounded-md border border-white/15 bg-[#12182c] px-3 text-lg"
          style={{ fontFamily: '"MagicMedieval", serif' }}
        />
        <p className="mt-1 text-right text-[10px] text-gray-500">{name.length}/20</p>
      </div>
    </div>
  );
}
