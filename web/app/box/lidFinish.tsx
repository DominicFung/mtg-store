'use client';

import { cleanLidText } from '../../../packages/print-core/src/lidText';
import type { Filament } from '../lib/filamentCatalogue';

export const DEFAULT_BOX_FILAMENT_ID = 'elegoo-pla-black';
export const DEFAULT_LOGO_FILAMENT_ID = 'elegoo-pla-red';
export const DEFAULT_TEXT_FILAMENT_ID = 'giantarm-silk-silver';

type Props = {
  filaments: Filament[];
  boxId: string;
  logoId: string;
  textId: string;
  name: string;
  open: number;
  onBox: (id: string) => void;
  onLogo: (id: string) => void;
  onTextColour: (id: string) => void;
  onName: (value: string) => void;
  onOpen: (value: number) => void;
};

export function filamentById(filaments: Filament[], id: string, fallbackId: string): Filament | null {
  const stock = filaments.filter((filament) => filament.inStock);
  return stock.find((filament) => filament.id === id)
    ?? stock.find((filament) => filament.id === fallbackId)
    ?? stock[0]
    ?? null;
}

export default function LidFinish({
  filaments,
  boxId,
  logoId,
  textId,
  name,
  open,
  onBox,
  onLogo,
  onTextColour,
  onName,
  onOpen,
}: Props) {
  const stock = filaments.filter((filament) => filament.inStock);
  const box = filamentById(filaments, boxId, DEFAULT_BOX_FILAMENT_ID);
  const logo = filamentById(filaments, logoId, DEFAULT_LOGO_FILAMENT_ID);
  const textColour = filamentById(filaments, textId, DEFAULT_TEXT_FILAMENT_ID);
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
          onChange={(event) => onOpen(Number(event.target.value) / 100)}
          className="mt-2 h-11 w-full cursor-pointer accent-[#e2c275]"
        />
        <div className="flex justify-between text-[10px] uppercase tracking-wide text-gray-500">
          <span>Closed</span>
          <span>Open</span>
        </div>
      </div>

      <Swatches
        label="Box colour"
        hint="Colours the shell and the lid."
        filaments={stock}
        selectedId={box?.id ?? ''}
        onSelect={onBox}
      />
      <Swatches
        label="Magic logo"
        hint="The planeswalker spark on the lid."
        filaments={stock}
        selectedId={logo?.id ?? ''}
        onSelect={onLogo}
      />
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
      <Swatches
        label="Name colour"
        hint={name.trim() ? 'Used for the raised name.' : 'Choose a colour, then add a name if you want one.'}
        filaments={stock}
        selectedId={textColour?.id ?? ''}
        onSelect={onTextColour}
      />
    </div>
  );
}

function Swatches({
  label,
  hint,
  filaments,
  selectedId,
  onSelect,
}: {
  label: string;
  hint: string;
  filaments: Filament[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const selected = filaments.find((filament) => filament.id === selectedId);
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-[#e2c275]">{label}</legend>
      <p className="mt-1 text-xs text-gray-400">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {filaments.map((filament) => {
          const active = filament.id === selectedId;
          return (
            <button
              key={filament.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={filament.name}
              title={filament.name}
              onClick={() => onSelect(filament.id)}
              className={`h-11 w-11 rounded-md border-2 ${active ? 'border-[#e2c275]' : 'border-white/25'}`}
              style={{ backgroundColor: filament.hex }}
            />
          );
        })}
      </div>
      {selected && <p className="mt-2 text-sm">{selected.name}</p>}
    </fieldset>
  );
}
