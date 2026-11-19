import type { AppSyncResolverEvent } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { assertAdmin } from '../../orders/auth';
import {
  assertShipped,
  assertTransition,
  canRetry,
  customerStatusEmail,
  isOrderStatus,
  nextFulfillment,
  previousFulfillment,
  SHOP_PARTITION,
  type OrderStatus,
} from '../../orders/logic';
import {
  documentClient,
  enqueueGeneration,
  getOrder,
  emailCustomer,
  notifyCustomer,
  presignPut,
  requiredEnv,
  updateOrder,
} from '../../orders/store';
import { summary, withImages, type OrderItem } from '../../orders/view';

type Args = {
  status?: string;
  email?: string;
  limit?: number;
  orderId?: string;
  nextStatus?: string;
  carrier?: string;
  trackingNumber?: string;
  note?: string;
  contentType?: string;
  byteLength?: number;
  key?: string;
};

function asOrder(item: Record<string, unknown> | undefined): OrderItem {
  if (!item || typeof item.orderId !== 'string' || item.orderId.startsWith('lock#')) {
    throw new Error('Order not found');
  }
  return item as OrderItem;
}

export const handler = async (event: AppSyncResolverEvent<Args>) => {
  assertAdmin(event.identity);
  const field = event.info?.fieldName;
  if (field === 'listOrders') return listOrders(event.arguments ?? {});
  if (field === 'getAdminOrder') return withImages(asOrder(await getOrder(event.arguments?.orderId ?? '')), true);
  if (field === 'refreshDownloadLinks') return withImages(asOrder(await getOrder(event.arguments?.orderId ?? '')), true);
  if (field === 'updateOrderStatus') return updateStatus(event.arguments ?? {});
  if (field === 'retryOrderGeneration') return retry(event.arguments?.orderId ?? '');
  if (field === 'advanceOrder') return moveFulfillment(event.arguments?.orderId ?? '', 'next');
  if (field === 'undoOrder') return moveFulfillment(event.arguments?.orderId ?? '', 'previous');
  if (field === 'requestDeliveryPhotoUpload') return requestPhoto(event.arguments ?? {});
  if (field === 'confirmDelivery') return confirmDelivery(event.arguments ?? {});
  throw new Error(`Unsupported admin field ${field ?? ''}`);
};

async function listOrders(args: Args) {
  const limit = Math.min(100, Math.max(1, Math.round(args.limit ?? 50)));
  const email = args.email?.trim().toLowerCase();
  const status = args.status?.trim();
  const table = requiredEnv('ORDERS_TABLE_NAME');
  const query = email
    ? {
      IndexName: 'email-createdAt',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email } as Record<string, unknown>,
    }
    : status && isOrderStatus(status)
      ? {
        IndexName: 'status-createdAt',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status } as Record<string, unknown>,
      }
      : {
        IndexName: 'shop-createdAt',
        KeyConditionExpression: 'shop = :shop',
        ExpressionAttributeValues: { ':shop': SHOP_PARTITION } as Record<string, unknown>,
      };
  const result = await documentClient.send(new QueryCommand({
    TableName: table,
    ...query,
    Limit: limit,
    ScanIndexForward: false,
  }));
  return (result.Items ?? [])
    .filter((item) => typeof item.orderId === 'string' && !String(item.orderId).startsWith('lock#'))
    .filter((item) => !status || item.status === status)
    .map((item) => summary(item as OrderItem));
}

async function updateStatus(args: Args) {
  const order = asOrder(await getOrder(args.orderId ?? ''));
  const next = args.nextStatus ?? '';
  if (!isOrderStatus(next)) throw new Error('Unknown status');
  const now = new Date().toISOString();
  let carrier = order.carrier;
  let trackingNumber = order.trackingNumber;
  if (next === 'SHIPPED') {
    const shipped = assertShipped(order.status, args.carrier ?? '', args.trackingNumber ?? '');
    carrier = shipped.carrier;
    trackingNumber = shipped.trackingNumber;
  } else {
    assertTransition(order.status, next);
  }
  const note = args.note?.trim();
  const history = [...(order.history ?? []), { status: next, at: now, actor: 'admin', note }];
  await updateOrder(order.orderId, {
    status: next,
    updatedAt: now,
    history,
    carrier: carrier ?? null,
    trackingNumber: trackingNumber ?? null,
  }, 'attribute_exists(orderId)');
  if (process.env.CUSTOMER_STATUS_EMAILS === 'true') {
    const mail = customerStatusEmail({ orderNumber: order.orderNumber, status: next as OrderStatus, carrier: carrier ?? undefined, trackingNumber: trackingNumber ?? undefined });
    try {
      await notifyCustomer(order.email, mail.subject, mail.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Customer email failed';
      await updateOrder(order.orderId, { notifyError: message }, 'attribute_exists(orderId)');
    }
  }
  return summary({ ...order, status: next, updatedAt: now, carrier, trackingNumber });
}

async function moveFulfillment(orderId: string, direction: 'next' | 'previous') {
  const order = asOrder(await getOrder(orderId));
  const next = direction === 'next' ? nextFulfillment(order.status) : previousFulfillment(order.status);
  if (!next) throw new Error('That order cannot move that way');
  if (next === 'DELIVERED') throw new Error('Take the door photo before marking it delivered');
  const now = new Date().toISOString();
  const history = [...(order.history ?? []), { status: next, at: now, actor: 'admin', note: direction === 'next' ? 'Status advanced' : 'Status undone' }];
  const carrier = next === 'SHIPPED' ? 'In person' : order.carrier ?? null;
  const trackingNumber = next === 'SHIPPED' ? 'Local delivery' : order.trackingNumber ?? null;
  await updateOrder(order.orderId, {
    status: next,
    updatedAt: now,
    history,
    carrier,
    trackingNumber,
  }, 'attribute_exists(orderId)');
  if (next === 'SHIPPED' || next === 'DELIVERED') {
    const mail = customerStatusEmail({ orderNumber: order.orderNumber, email: order.email, status: next, carrier: carrier ?? undefined, trackingNumber: trackingNumber ?? undefined });
    try {
      await emailCustomer(order.email, mail.subject, mail.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Customer email failed';
      await updateOrder(order.orderId, { customerNotifyError: message.slice(0, 500) }, 'attribute_exists(orderId)');
    }
  }
  return summary({ ...order, status: next, updatedAt: now, carrier: carrier ?? undefined, trackingNumber: trackingNumber ?? undefined });
}

async function requestPhoto(args: Args) {
  const order = asOrder(await getOrder(args.orderId ?? ''));
  const contentType = args.contentType === 'image/png' ? 'image/png' : 'image/jpeg';
  const byteLength = Number(args.byteLength);
  if (!Number.isInteger(byteLength) || byteLength < 1000 || byteLength > 2_000_000) throw new Error('The photo must be under 2 MB');
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  const key = `orders/${order.orderId}/delivery/${Date.now()}.${extension}`;
  const signed = await presignPut(key, byteLength, contentType);
  return { key, url: signed.url, headersJson: JSON.stringify(signed.headers) };
}

async function confirmDelivery(args: Args) {
  const order = asOrder(await getOrder(args.orderId ?? ''));
  const key = (args.key ?? '').trim();
  if (!key.startsWith(`orders/${order.orderId}/delivery/`)) throw new Error('That photo does not belong to this order');
  if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') throw new Error('Mark it out for delivery before the door photo');
  const now = new Date().toISOString();
  const history = order.status === 'DELIVERED'
    ? order.history ?? []
    : [...(order.history ?? []), { status: 'DELIVERED', at: now, actor: 'admin', note: 'Delivered with a door photo' }];
  await updateOrder(order.orderId, {
    status: 'DELIVERED',
    updatedAt: now,
    history,
    deliveryPhotoKey: key,
  }, 'attribute_exists(orderId)');
  if (order.status !== 'DELIVERED') {
    const mail = customerStatusEmail({ orderNumber: order.orderNumber, email: order.email, status: 'DELIVERED' });
    try {
      await emailCustomer(order.email, mail.subject, mail.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Customer email failed';
      await updateOrder(order.orderId, { customerNotifyError: message.slice(0, 500) }, 'attribute_exists(orderId)');
    }
  }
  return summary({ ...order, status: 'DELIVERED', updatedAt: now });
}

async function retry(orderId: string) {
  const order = asOrder(await getOrder(orderId));
  if (!canRetry(order.status)) throw new Error(`Cannot regenerate files from ${order.status}`);
  const now = new Date().toISOString();
  const attempt = Number(order.generationAttempt ?? 0) + 1;
  const history = [...(order.history ?? []), { status: 'GENERATING_FILES', at: now, actor: 'admin', note: 'Retry generation' }];
  await updateOrder(order.orderId, {
    status: 'GENERATING_FILES',
    updatedAt: now,
    generationAttempt: attempt,
    history,
    errorMessage: null,
    outputKey: null,
  }, 'attribute_exists(orderId)');
  await enqueueGeneration(order.orderId, attempt);
  return summary({ ...order, status: 'GENERATING_FILES', updatedAt: now, errorMessage: undefined });
}
