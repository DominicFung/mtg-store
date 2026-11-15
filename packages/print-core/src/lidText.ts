/** Optional name on the lid. MagicMedieval has no plus sign. */
export const LID_TEXT_MAX = 20;

/** Bundled with the shop and the generator. Family MagicMedieval, Regular. */
export const LID_FONT_FILE = 'MagicMedieval-Regular.ttf';

const LID_TEXT_UNSUPPORTED = /[^A-Za-z0-9 '&.,-]/;

export function cleanLidText(raw: string): string {
  return raw.replace(LID_TEXT_UNSUPPORTED, '').slice(0, LID_TEXT_MAX);
}

export function normalizeLidText(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') throw new Error('The lid name is invalid');
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.length > LID_TEXT_MAX) throw new Error('The lid name can be at most 20 characters');
  if (LID_TEXT_UNSUPPORTED.test(text)) {
    throw new Error('The lid name can use letters, numbers, spaces, and . , \' & -');
  }
  return text;
}
