/**
 * Local delivery for one printed deck box.
 *
 * The postal-code FSA is the authority when the customer gives a Canadian
 * postal code (or just the FSA). A matching city cannot override a postal
 * code outside the area, and a mismatched city cannot block an FSA that is
 * inside it.
 *
 * Toronto is every M postal area, which includes the old cities that are now
 * part of Toronto: North York, Scarborough, East York, and York, plus
 * Etobicoke (M8 and M9). Mississauga is the L4T–L4Z and L5* areas listed
 * below, not neighbouring cities that share an L4 or L5 letter. Milton is
 * L9T and L9E.
 *
 * If the postal code is missing or not a Canadian FSA, the city name is the
 * fallback, and the province and country have to be Ontario and Canada when
 * they are filled in.
 */

export type DeliveryInput = {
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type DeliveryDecision = {
  ok: boolean;
  message: string;
};

const MISSISSAUGA_FSA = [
  'L4T', 'L4V', 'L4W', 'L4X', 'L4Y', 'L4Z',
  'L5A', 'L5B', 'L5C', 'L5E', 'L5G', 'L5H', 'L5J', 'L5K', 'L5L', 'L5M',
  'L5N', 'L5P', 'L5R', 'L5S', 'L5T', 'L5V', 'L5W',
] as const;

const MILTON_FSA = ['L9T', 'L9E'] as const;

const FSA_ALLOW = new Set<string>([...MISSISSAUGA_FSA, ...MILTON_FSA]);

const CITY_ALLOW = new Set([
  'toronto',
  'city of toronto',
  'north york',
  'scarborough',
  'east york',
  'york',
  'etobicoke',
  'mississauga',
  'milton',
]);

export const OUTSIDE_DELIVERY_MESSAGE = 'We can only deliver in person in Mississauga, Milton, Etobicoke, and Toronto. That address is outside the area, so we can’t take payment for it.';

export function postalFsa(postalCode: string | null | undefined): string | null {
  const compact = (postalCode ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (compact.length < 3) return null;
  const fsa = compact.slice(0, 3);
  return /^[A-Z]\d[A-Z]$/.test(fsa) ? fsa : null;
}

export function fsaInDeliveryArea(fsa: string): boolean {
  const code = fsa.toUpperCase();
  if (/^M\d[A-Z]$/.test(code)) return true;
  return FSA_ALLOW.has(code);
}

function normalizePlace(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}

function isCanada(country: string): boolean {
  return country === '' || country === 'canada' || country === 'ca';
}

function isOntario(region: string): boolean {
  return region === '' || region === 'on' || region === 'ontario' || region === 'ont';
}

export function checkDelivery(input: DeliveryInput): DeliveryDecision {
  const country = normalizePlace(input.country);
  const region = normalizePlace(input.region);
  const city = normalizePlace(input.city);
  if (!isCanada(country)) {
    return { ok: false, message: OUTSIDE_DELIVERY_MESSAGE };
  }
  const fsa = postalFsa(input.postalCode);
  if (fsa) {
    if (!fsaInDeliveryArea(fsa)) return { ok: false, message: OUTSIDE_DELIVERY_MESSAGE };
    return { ok: true, message: 'We can deliver to this address.' };
  }
  if (!isOntario(region)) return { ok: false, message: OUTSIDE_DELIVERY_MESSAGE };
  if (CITY_ALLOW.has(city)) return { ok: true, message: 'We can deliver to this address.' };
  if (!city && !(input.postalCode ?? '').trim()) {
    return { ok: false, message: 'Add a postal code so we can check local delivery.' };
  }
  return { ok: false, message: OUTSIDE_DELIVERY_MESSAGE };
}
