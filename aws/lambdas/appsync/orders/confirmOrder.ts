import type { AppSyncResolverEvent } from 'aws-lambda';
import { normalizeEmail, orderObjectKeys } from '../../orders/logic';
import {
  enqueueGeneration,
  findByOrderNumber,
  objectExists,
  updateOrder,
} from '../../orders/store';
import { summary, type OrderItem } from '../../orders/view';

export const handler = async (event: AppSyncResolverEvent<{ orderNumber: string; email: string }>) => {
  const orderNumber = (event.arguments?.orderNumber ?? '').trim();
  const email = normalizeEmail(event.arguments?.email ?? '');
  const order = await findByOrderNumber(orderNumber) as OrderItem | undefined;
  if (!order || order.email !== email) throw new Error('Order not found');
  if (order.status !== 'RECEIVED') return summary(order);

  const keys = orderObjectKeys(order.orderId);
  const present = await Promise.all(keys.crops.map((key) => objectExists(key)));
  if (present.some((found) => !found)) throw new Error('The face images have not finished uploading');

  const now = new Date().toISOString();
  const attempt = Number(order.generationAttempt ?? 0) + 1;
  const history = [...(order.history ?? []), { status: 'GENERATING_FILES', at: now, actor: 'system', note: 'Generating print files' }];
  try {
    await updateOrder(order.orderId, {
      status: 'GENERATING_FILES',
      updatedAt: now,
      generationAttempt: attempt,
      history,
      errorMessage: null,
    }, 'status = :received', { ':received': 'RECEIVED' });
  } catch {
    const current = await findByOrderNumber(orderNumber) as OrderItem | undefined;
    if (!current) throw new Error('Order not found');
    return summary(current);
  }
  await enqueueGeneration(order.orderId, attempt);
  return summary({ ...order, status: 'GENERATING_FILES', updatedAt: now });
};
