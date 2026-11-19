import { lidMarkForFilaments } from '../../../packages/print-core/src/lidMarks';
import type { ShopLid } from '../lib/shopOrders';

export default function LidSummary({ lid }: { lid?: ShopLid | null }) {
  if (!lid) return null;
  return (
    <ul className="space-y-1 text-sm">
      <li className="flex items-center gap-2">
        <Swatch hex={lid.boxHex} />
        Box and lid · {lid.boxFilamentName}
      </li>
      <li className="flex items-center gap-2">
        <MarkSwatch logo={lid.logoHex} text={lid.textHex} />
        {markLine(lid)}
      </li>
      <li className="flex items-center gap-2">
        <span className="inline-block h-3 w-3" />
        {lid.text ? `Name on the lid · ${lid.text}` : 'No name on the lid'}
      </li>
    </ul>
  );
}

function markLine(lid: ShopLid): string {
  const mark = lidMarkForFilaments(lid.logoFilamentId, lid.textFilamentId);
  if (mark) return `Logo and name · ${mark.name}`;
  return `Magic logo · ${lid.logoFilamentName}`;
}

function Swatch({ hex }: { hex: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/20" style={{ backgroundColor: hex }} />;
}

function MarkSwatch({ logo, text }: { logo: string; text?: string | null }) {
  if (!text || text.toLowerCase() === logo.toLowerCase()) return <Swatch hex={logo} />;
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/20"
      style={{ background: `linear-gradient(to top right, ${text} 50%, ${logo} 50%)` }}
    />
  );
}
