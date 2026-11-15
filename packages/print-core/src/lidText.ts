/** Optional name on the lid. Letters, numbers, spaces, and simple punctuation. */
export const LID_TEXT_MAX = 20;

export function cleanLidText(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 '&.,+-]/g, '').slice(0, LID_TEXT_MAX);
}

export function normalizeLidText(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') throw new Error('The lid name is invalid');
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text) return '';
  if (text.length > LID_TEXT_MAX) throw new Error('The lid name can be at most 20 characters');
  if (/[^A-Za-z0-9 '&.,+-]/.test(text)) {
    throw new Error('The lid name can use letters, numbers, and simple punctuation');
  }
  return text;
}
