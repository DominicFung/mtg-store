import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PAYMENT_STATUS_PAID } from '../../../packages/print-core/src/orderNumber';
import { isStripeWebhookConfigured, PAYMENTS_NOT_CONFIGURED, verifyStripeSignature } from '../../../packages/print-core/src/stripeConfig';
import { canBackstopEnqueue } from '../orders/logic';
import { deliverPaidMail } from '../orders/paidNotice';
import { enqueueGeneration, findByOrderNumber, updateOrder } from '../orders/store';
import { json, rawBody } from './http';
import { readSecret } from './secrets';

type PaidOrder = {
  orderId?: string;
  status?: string;
  outputKey?: string;
  generationStatus?: string;
  generationAttempt?: number;
  history?: unknown[];
  paymentStatus?: string;
};

export async function enqueueIfNeeded(
  order: PaidOrder,
  deps: {
    updateOrder: typeof updateOrder;
    enqueueGeneration: typeof enqueueGeneration;
  } = { updateOrder, enqueueGeneration },
): Promise<boolean> {
  if (!order.orderId || !canBackstopEnqueue(order)) return false;
  const attempt = Number(order.generationAttempt ?? 0) + 1;
  const now = new Date().toISOString();
  try {
    await deps.updateOrder(String(order.orderId), {
      generationStatus: 'GENERATING',
      generationAttempt: attempt,
      generationError: null,
      updatedAt: now,
    }, 'attribute_not_exists(outputKey) AND (attribute_not_exists(#gs) OR #gs <> :generating)', {
      ':generating': 'GENERATING',
    }, { '#gs': 'generationStatus' });
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    if (name === 'ConditionalCheckFailedException') return false;
    throw error;
  }
  await deps.enqueueGeneration(String(order.orderId), attempt);
  return true;
}

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
    const alreadyPaid = order.paymentStatus === PAYMENT_STATUS_PAID;
    if (!alreadyPaid) {
      const now = new Date().toISOString();
      const history = Array.isArray(order.history) ? [...order.history] : [];
      history.push({ status: String(order.status ?? 'RECEIVED'), at: now, actor: 'stripe', note: 'Card payment received' });
      await updateOrder(String(order.orderId), {
        paymentStatus: PAYMENT_STATUS_PAID,
        updatedAt: now,
        history,
      });
    }
    const queued = await enqueueIfNeeded(order);
    await deliverPaidMail(String(order.orderId));
    return json(200, { ok: true, paid: true, alreadyPaid, queued });
  } catch (error) {
    console.error('payment notice failed', error instanceof Error ? error.name : 'error');
    return json(503, { ok: false, code: 'payments_not_configured', message: PAYMENTS_NOT_CONFIGURED });
  }
};
