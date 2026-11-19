import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BOX_PRICE_CENTS } from '../../../packages/print-core/src/orderNumber';
import { checkDelivery, type DeliveryInput } from '../../../packages/print-core/src/deliveryArea';
import { isStripeSecretConfigured, PAYMENTS_NOT_CONFIGURED } from '../../../packages/print-core/src/stripeReady';
import { findByOrderNumber } from '../orders/store';
import { json, rawBody } from './http';
import { readSecret } from './secrets';

type CheckoutBody = DeliveryInput & {
  orderNumber?: string;
  email?: string;
  successUrl?: string;
  cancelUrl?: string;
};

function storedAddress(item: Record<string, unknown>): DeliveryInput {
  return {
    city: typeof item.city === 'string' ? item.city : '',
    region: typeof item.region === 'string' ? item.region : '',
    postalCode: typeof item.postalCode === 'string' ? item.postalCode : '',
    country: typeof item.country === 'string' ? item.country : '',
  };
}

export async function createCheckoutSession(secret: string, input: {
  orderNumber: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', input.successUrl);
  params.set('cancel_url', input.cancelUrl);
  params.set('customer_email', input.email);
  params.set('payment_intent_data[receipt_email]', input.email);
  params.set('client_reference_id', input.orderNumber);
  params.set('metadata[orderNumber]', input.orderNumber);
  params.set('metadata[email]', input.email);
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'cad');
  params.set('line_items[0][price_data][unit_amount]', String(BOX_PRICE_CENTS));
  params.set('line_items[0][price_data][product_data][name]', 'Commander Deck Box');
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const payload = await response.json() as { url?: string; error?: { message?: string } };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message || 'Stripe did not start the payment');
  }
  return payload.url;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const body = JSON.parse(rawBody(event) || '{}') as CheckoutBody;
    const orderNumber = (body.orderNumber ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    if (!orderNumber || !email || !body.successUrl || !body.cancelUrl) {
      return json(400, { ok: false, code: 'missing_fields', message: 'The payment is missing the order or the return address.' });
    }
    const order = await findByOrderNumber(orderNumber);
    if (!order || String(order.email ?? '').toLowerCase() !== email) {
      return json(404, { ok: false, code: 'order_not_found', message: 'That order was not found for this email.' });
    }
    const decision = checkDelivery(storedAddress(order));
    if (!decision.ok) return json(400, { ok: false, code: 'outside_delivery_area', message: decision.message });

    const secret = await readSecret(process.env.STRIPE_SECRET_ID);
    if (!isStripeSecretConfigured(secret)) {
      return json(503, { ok: false, code: 'payments_not_configured', message: PAYMENTS_NOT_CONFIGURED });
    }
    try {
      const url = await createCheckoutSession(secret, {
        orderNumber,
        email,
        successUrl: body.successUrl,
        cancelUrl: body.cancelUrl,
      });
      return json(200, { ok: true, url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start the payment';
      return json(502, { ok: false, code: 'payment_failed', message });
    }
  } catch (error) {
    console.error('checkout failed', error instanceof Error ? error.name : 'error');
    return json(503, { ok: false, code: 'payments_not_configured', message: PAYMENTS_NOT_CONFIGURED });
  }
};
