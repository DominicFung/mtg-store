import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PAYMENT_STATUS_PAID } from '../../../packages/print-core/src/orderNumber';
import { isStripeWebhookConfigured, PAYMENTS_NOT_CONFIGURED, verifyStripeSignature } from '../../../packages/print-core/src/stripeConfig';
import { findByOrderNumber, updateOrder } from '../orders/store';
import { json, rawBody } from './http';
import { readSecret } from './secrets';

type StripeEvent = {
  type?: string;
  data?: {
    object?: {
      client_reference_id?: string;
      payment_status?: string;
      metadata?: { orderNumber?: string; email?: string };
    };
  };
};

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const payload = rawBody(event);
    const secret = await readSecret(process.env.STRIPE_WEBHOOK_SECRET_ID);
    if (!isStripeWebhookConfigured(secret)) {
      return json(503, { ok: false, code: 'payments_not_configured', message: PAYMENTS_NOT_CONFIGURED });
    }
    const signature = event.headers?.['stripe-signature'] ?? event.headers?.['Stripe-Signature'];
    if (!verifyStripeSignature(payload, signature, secret)) {
      return json(400, { ok: false, code: 'bad_signature', message: 'The payment notice could not be verified.' });
    }
    const notice = JSON.parse(payload) as StripeEvent;
    if (notice.type !== 'checkout.session.completed') return json(200, { ok: true, ignored: true });
    const session = notice.data?.object;
    if (session?.payment_status && session.payment_status !== 'paid') return json(200, { ok: true, ignored: true });
    const orderNumber = session?.metadata?.orderNumber || session?.client_reference_id || '';
    const email = (session?.metadata?.email ?? '').trim().toLowerCase();
    const order = await findByOrderNumber(orderNumber);
    if (!order || (email && String(order.email ?? '').toLowerCase() !== email)) {
      return json(404, { ok: false, code: 'order_not_found', message: 'That order was not found.' });
    }
    if (order.paymentStatus === PAYMENT_STATUS_PAID) return json(200, { ok: true, alreadyPaid: true });
    const now = new Date().toISOString();
    const history = Array.isArray(order.history) ? [...order.history] : [];
    history.push({ status: String(order.status ?? 'RECEIVED'), at: now, actor: 'stripe', note: 'Card payment received' });
    await updateOrder(String(order.orderId), {
      paymentStatus: PAYMENT_STATUS_PAID,
      updatedAt: now,
      history,
    });
    return json(200, { ok: true, paid: true });
  } catch (error) {
    console.error('payment notice failed', error instanceof Error ? error.name : 'error');
    return json(503, { ok: false, code: 'payments_not_configured', message: PAYMENTS_NOT_CONFIGURED });
  }
};
