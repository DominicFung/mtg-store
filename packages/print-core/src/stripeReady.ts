const PLACEHOLDER = 'REPLACE_ME';

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function isStripeSecretConfigured(value: string | null | undefined): boolean {
  const key = clean(value);
  if (!key || key.includes(PLACEHOLDER)) return false;
  return /^sk_(test|live)_/.test(key);
}

export function isStripePublishableConfigured(value: string | null | undefined): boolean {
  const key = clean(value);
  if (!key || key.includes(PLACEHOLDER)) return false;
  return /^pk_(test|live)_/.test(key);
}

export function isStripeWebhookConfigured(value: string | null | undefined): boolean {
  const key = clean(value);
  if (!key || key.includes(PLACEHOLDER)) return false;
  return key.startsWith('whsec_');
}

/** True when the browser has a real publishable key and the checkout endpoint. */
export function paymentsReady(publishableKey: string | null | undefined, paymentsUrl: string | null | undefined): boolean {
  return isStripePublishableConfigured(publishableKey) && clean(paymentsUrl).startsWith('https://');
}

export const PAYMENTS_NOT_CONFIGURED = 'payments not configured';
