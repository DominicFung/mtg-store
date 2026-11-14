export const PRICE_LABEL = 'Price confirmed before printing';
/** Payments are not wired. See the PAYMENT_HOOK in submitOrder. */
export const PAYMENT_STATUS = 'NOT_CONNECTED';

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
