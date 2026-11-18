import { createHmac, timingSafeEqual } from 'node:crypto';
import { isStripeWebhookConfigured } from './stripeReady';

export {
  PAYMENTS_NOT_CONFIGURED,
  isStripePublishableConfigured,
  isStripeSecretConfigured,
  isStripeWebhookConfigured,
  paymentsReady,
} from './stripeReady';

/**
 * Stripe signs `t=<unix>,v1=<hex>`. Reject a missing secret, a bad signature,
 * or a timestamp more than five minutes off.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!isStripeWebhookConfigured(secret)) return false;
  const signed = header ?? '';
  const timestamp = /(?:^|,)t=(\d+)/.exec(signed)?.[1];
  const signatures = [...signed.matchAll(/(?:^|,)v1=([0-9a-f]+)/gi)].map((match) => match[1] ?? '');
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac('sha256', (secret ?? '').trim()).update(`${timestamp}.${payload}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  return signatures.some((signature) => {
    const actual = Buffer.from(signature, 'utf8');
    return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf);
  });
}
