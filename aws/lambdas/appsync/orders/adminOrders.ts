import type { AppSyncResolverEvent } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { assertAdmin } from '../../orders/auth';
import {
  assertShipped,
  assertTransition,
  customerStatusEmail,
  fulfillmentPreserved,
  isOrderStatus,
  newestOrders,
  nextFulfillment,
  ORDER_STATUSES,
  orderObjectKeys,
  previousFulfillment,
  type OrderStatus,
} from '../../orders/logic';
import {
  documentClient,
  enqueueGeneration,
  getOrder,
  emailCustomer,
  notifyCustomer,
  listOrderOutput,
  objectExists,
  objectSize,
  presignGet,
  presignPut,
  readObjectRange,
  requiredEnv,
  updateOrder,
  uploadChunks,
} from '../../orders/store';
import { streamFacesZip } from '../../orders/facesZip';
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
  if (field === 'getAdminOrder') return adminDetail(event.arguments?.orderId ?? '');
  if (field === 'refreshDownloadLinks') return refreshDownloads(event.arguments?.orderId ?? '');
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
      : null;
  if (!query) {
    const pages = await Promise.all(ORDER_STATUSES.map((entry) => documentClient.send(new QueryCommand({
      TableName: table,
      IndexName: 'status-createdAt',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': entry },
      Limit: limit,
      ScanIndexForward: false,
    }))));
    return newestOrders(pages.map((page) => (page.Items ?? []) as OrderItem[]), limit).map((item) => summary(item));
  }
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

async function refreshDownloads(orderId: string) {
  const order = asOrder(await getOrder(orderId));
  const keys = orderObjectKeys(order.orderId);
  if (order.outputKey && !(await objectExists(keys.facesZip))) {
    const size = await objectSize(order.outputKey);
    await uploadChunks(keys.facesZip, (sink) => streamFacesZip(
      (start, end) => readObjectRange(order.outputKey as string, start, end),
      size,
      sink,
    ));
  }
  const detail = await withImages({ ...order, outputKey: order.outputKey }, true);
  return {
    ...detail,
    downloadUrl: order.outputKey ? await presignGet(order.outputKey, undefined, 'deck-box.zip') : null,
    facesDownloadUrl: order.outputKey ? await presignGet(keys.facesZip, undefined, 'deck-box-faces.zip') : null,
  };
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

async function adminDetail(orderId: string) {
  const order = asOrder(await getOrder(orderId));
  const detail = await withImages(order, true);
  const generatedFiles = await listOrderOutput(order.orderId);
  return { ...detail, generatedFiles };
}

async function retry(orderId: string) {
  const order = asOrder(await getOrder(orderId));
  if (order.status === 'CANCELLED') throw new Error('Cannot generate files for a cancelled order');
  if (order.generationStatus === 'GENERATING') throw new Error('Files are already being generated');
  const now = new Date().toISOString();
  const attempt = Number(order.generationAttempt ?? 0) + 1;
  const preserve = fulfillmentPreserved(order.status);
  const updates: Record<string, unknown> = {
    generationStatus: 'GENERATING',
    generationAttempt: attempt,
    generationError: null,
    updatedAt: now,
  };
  if (!preserve) {
    updates.status = 'GENERATING_FILES';
    updates.history = [...(order.history ?? []), { status: 'GENERATING_FILES', at: now, actor: 'admin', note: order.outputKey ? 'Regenerate files' : 'Generate files' }];
  }
  await updateOrder(order.orderId, updates, 'attribute_exists(orderId) AND (attribute_not_exists(#gs) OR #gs <> :generating)', {
    ':generating': 'GENERATING',
  }, { '#gs': 'generationStatus' });
  await enqueueGeneration(order.orderId, attempt);
  return summary({
    ...order,
    status: preserve ? order.status : 'GENERATING_FILES',
    generationStatus: 'GENERATING',
    updatedAt: now,
    errorMessage: undefined,
  });
}
