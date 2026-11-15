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
        <Swatch hex={lid.logoHex} />
        Magic logo · {lid.logoFilamentName}
      </li>
      <li className="flex items-center gap-2">
        {lid.text && lid.textHex ? <Swatch hex={lid.textHex} /> : <span className="inline-block h-3 w-3" />}
        {lid.text ? `Name on the lid · ${lid.text}${lid.textFilamentName ? ` · ${lid.textFilamentName}` : ''}` : 'No name on the lid'}
      </li>
    </ul>
  );
}

function Swatch({ hex }: { hex: string }) {
  return <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-white/20" style={{ backgroundColor: hex }} />;
}
