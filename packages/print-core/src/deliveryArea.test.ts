import { describe, expect, it } from '@jest/globals';
import { checkDelivery, fsaInDeliveryArea, postalFsa } from './deliveryArea';
import { imageCoversCrop } from './outpaint';
import { BOX_PRICE_CENTS, BOX_PRICE_LABEL } from './orderNumber';
import {
  isStripePublishableConfigured,
  isStripeSecretConfigured,
  isStripeWebhookConfigured,
  paymentsReady,
  verifyStripeSignature,
} from './stripeConfig';
import { createHmac } from 'node:crypto';

describe('local delivery', () => {
  it('trusts the postal FSA over the city name', () => {
    expect(postalFsa('m5v 2t6')).toBe('M5V');
    expect(postalFsa('M8V1A1')).toBe('M8V');
    expect(fsaInDeliveryArea('M5V')).toBe(true);
    expect(fsaInDeliveryArea('M8V')).toBe(true);
    expect(fsaInDeliveryArea('M9A')).toBe(true);
    expect(fsaInDeliveryArea('L5B')).toBe(true);
    expect(fsaInDeliveryArea('L4T')).toBe(true);
    expect(fsaInDeliveryArea('L9T')).toBe(true);
    expect(fsaInDeliveryArea('L9E')).toBe(true);
    expect(fsaInDeliveryArea('L6Y')).toBe(false);
    expect(fsaInDeliveryArea('V6B')).toBe(false);
    expect(checkDelivery({
      city: 'Vancouver',
      region: 'BC',
      postalCode: 'M5V 2T6',
      country: 'Canada',
    }).ok).toBe(true);
    expect(checkDelivery({
      city: 'Toronto',
      region: 'Ontario',
      postalCode: 'V6B 1A1',
      country: 'Canada',
    }).ok).toBe(false);
  });

  it('accepts Toronto boroughs and rejects other cities when there is no postal code', () => {
    for (const city of ['Toronto', 'North York', 'Scarborough', 'East York', 'York', 'Etobicoke', 'Mississauga', 'Milton']) {
      expect(checkDelivery({ city, region: 'ON', country: 'Canada' }).ok).toBe(true);
    }
    expect(checkDelivery({ city: 'Brampton', region: 'Ontario', country: 'Canada' }).ok).toBe(false);
    expect(checkDelivery({ city: 'Toronto', region: 'Ontario', country: 'USA' }).ok).toBe(false);
    expect(checkDelivery({ city: '', postalCode: '' }).message).toMatch(/postal code/i);
  });
});

describe('crop skip', () => {
  it('skips only when both sides are at least 10% larger than the three-face frame', () => {
    expect(imageCoversCrop(1022, 396)).toBe(true);
    expect(imageCoversCrop(841, 326)).toBe(false);
    expect(imageCoversCrop(920, 400)).toBe(false);
    expect(imageCoversCrop(672, 936)).toBe(false);
    expect(imageCoversCrop(0, 400)).toBe(false);
  });
});

describe('stripe placeholders', () => {
  it('treats empty and REPLACE_ME values as not configured', () => {
    expect(BOX_PRICE_CENTS).toBe(5500);
    expect(BOX_PRICE_LABEL).toBe('CA$55');
    expect(isStripeSecretConfigured('REPLACE_ME')).toBe(false);
    expect(isStripeSecretConfigured('sk_test_REPLACE_ME')).toBe(false);
    expect(isStripeSecretConfigured('')).toBe(false);
    expect(isStripeSecretConfigured('sk_test_51abc')).toBe(true);
    expect(isStripePublishableConfigured('pk_test_REPLACE_ME')).toBe(false);
    expect(isStripePublishableConfigured('pk_test_51abc')).toBe(true);
    expect(isStripeWebhookConfigured('whsec_REPLACE_ME')).toBe(false);
    expect(isStripeWebhookConfigured('whsec_abc')).toBe(true);
    expect(paymentsReady('pk_test_51abc', 'https://example.com/checkout')).toBe(true);
    expect(paymentsReady('pk_test_REPLACE_ME', 'https://example.com/checkout')).toBe(false);
  });

  it('rejects a webhook signed with a placeholder secret', () => {
    const payload = '{"type":"checkout.session.completed"}';
    const timestamp = '1700000000';
    const signature = createHmac('sha256', 'whsec_abc').update(`${timestamp}.${payload}`).digest('hex');
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyStripeSignature(payload, header, 'whsec_abc', 1700000000 * 1000)).toBe(true);
    expect(verifyStripeSignature(payload, header, 'REPLACE_ME', 1700000000 * 1000)).toBe(false);
    expect(verifyStripeSignature(payload, header, 'whsec_other', 1700000000 * 1000)).toBe(false);
  });
});
