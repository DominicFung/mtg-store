import { BOX_PRICE_LABEL } from '../../../packages/print-core/src/orderNumber';
import {
  customerReceiptEmail,
  ownerPaidEmail,
  type LidFinish,
} from './logic';
import { getOrder, notifyOwner, updateOrder } from './store';

async function sendCustomer(to: string, subject: string, text: string): Promise<string | undefined> {
  const source = process.env.NOTIFY_EMAIL;
  if (!source) return 'NOTIFY_EMAIL is not set';
  try {
    const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses');
    await new SESClient({}).send(new SendEmailCommand({
      Source: source,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    }));
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'SES send failed';
  }
}

function asLid(value: unknown): LidFinish | null {
  if (!value || typeof value !== 'object') return null;
  const lid = value as LidFinish;
  return typeof lid.boxFilamentName === 'string' ? lid : null;
}

/** Customer receipt, then the shop print-file note once the zip exists. Failures stay on the order. */
export async function deliverPaidMail(orderId: string): Promise<void> {
  const order = await getOrder(orderId) as Record<string, unknown> | undefined;
  if (!order || order.paymentStatus !== 'PAID') return;
  const email = typeof order.email === 'string' ? order.email : '';
  const name = typeof order.name === 'string' ? order.name : 'Customer';
  const orderNumber = typeof order.orderNumber === 'string' ? order.orderNumber : '';
  if (email && orderNumber && !order.customerReceiptAt) {
    const receipt = customerReceiptEmail({
      orderNumber,
      name,
      email,
      priceLabel: typeof order.priceLabel === 'string' ? order.priceLabel : BOX_PRICE_LABEL,
    });
    const receiptError = await sendCustomer(email, receipt.subject, receipt.text);
    if (receiptError) {
      await updateOrder(orderId, { customerNotifyError: receiptError.slice(0, 500) }).catch(() => undefined);
    } else {
      try {
        await updateOrder(orderId, { customerReceiptAt: new Date().toISOString() }, 'attribute_not_exists(customerReceiptAt)');
      } catch {
        // The other writer already recorded the receipt.
      }
    }
  }
  if (order.printNoticeAt || !orderNumber || typeof order.orderId !== 'string') return;
  const profile = order.profileSnapshot as { name?: string; layerCount?: number } | undefined;
  const stops = Array.isArray(order.stops) ? order.stops as Array<{ name?: string; endLayer?: number; hex?: string }> : [];
  const mail = ownerPaidEmail({
    orderId: order.orderId,
    orderNumber,
    name,
    email,
    addressLine1: typeof order.addressLine1 === 'string' ? order.addressLine1 : null,
    city: typeof order.city === 'string' ? order.city : null,
    region: typeof order.region === 'string' ? order.region : null,
    postalCode: typeof order.postalCode === 'string' ? order.postalCode : null,
    country: typeof order.country === 'string' ? order.country : null,
    profileName: profile?.name ?? null,
    layerCount: profile?.layerCount ?? null,
    stops,
    lid: asLid(order.lid),
  });
  const notifyError = await notifyOwner(mail.subject, mail.text);
  if (notifyError) {
    await updateOrder(orderId, { notifyError: notifyError.slice(0, 500) }).catch(() => undefined);
    return;
  }
  try {
    await updateOrder(orderId, { printNoticeAt: new Date().toISOString() }, 'attribute_not_exists(printNoticeAt)');
  } catch {
    // The generator and the webhook can both reach this point.
  }
}
