/** One Commander deck box, in Canadian cents. There was no numeric price before this. */
export const BOX_PRICE_CENTS = 5500;
export const BOX_PRICE_LABEL = 'CA$55';
export const PRICE_LABEL = BOX_PRICE_LABEL;
/** New orders wait for the card payment. Older rows may still say NOT_CONNECTED. */
export const PAYMENT_STATUS = 'UNPAID';
export const PAYMENT_STATUS_PAID = 'PAID';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function defaultRandom(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available');
  }
  cryptoRef.getRandomValues(bytes);
  return bytes;
}

/** Unguessable shop order number. Lookup still requires the customer email. */
export function newOrderNumber(random: (size: number) => Uint8Array = defaultRandom): string {
  const bytes = random(8);
  let body = '';
  for (let index = 0; index < bytes.length; index += 1) {
    body += ALPHABET[bytes[index] % ALPHABET.length];
  }
  return `MR-${body}`;
}

export function isOrderNumber(value: string): boolean {
  return /^MR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(value);
}
