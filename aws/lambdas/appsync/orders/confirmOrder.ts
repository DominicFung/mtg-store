import type { AppSyncResolverEvent } from 'aws-lambda';
import { normalizeEmail, orderObjectKeys } from '../../orders/logic';
import {
  enqueueGeneration,
  findByOrderNumber,
  objectExists,
  updateOrder,
} from '../../orders/store';
import { summary, type OrderItem } from '../../orders/view';

export type ConfirmDeps = {
  findByOrderNumber: (orderNumber: string) => Promise<OrderItem | undefined>;
  objectExists: (key: string) => Promise<boolean>;
  updateOrder: typeof updateOrder;
  enqueueGeneration: (orderId: string, attempt: number) => Promise<void>;
};

function errorName(error: unknown): string {
  return error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
}

export async function confirmGeneration(deps: ConfirmDeps, orderNumberRaw: string, emailRaw: string) {
  const orderNumber = orderNumberRaw.trim();
  const email = normalizeEmail(emailRaw);
  const order = await deps.findByOrderNumber(orderNumber);
  if (!order || order.email !== email) throw new Error('Order not found');
  if (order.outputKey || order.generationStatus === 'GENERATING' || order.status === 'GENERATING_FILES') return summary(order);
  if (order.status !== 'RECEIVED' && order.status !== 'FAILED') return summary(order);

  const keys = orderObjectKeys(order.orderId);
  const present = await Promise.all(keys.crops.map((key) => deps.objectExists(key)));
  if (present.some((found) => !found)) throw new Error('The face images have not finished uploading');

  const now = new Date().toISOString();
  const attempt = Number(order.generationAttempt ?? 0) + 1;
  const history = [...(order.history ?? []), { status: 'GENERATING_FILES', at: now, actor: 'system', note: 'Generating print files' }];
  try {
    await deps.updateOrder(order.orderId, {
      status: 'GENERATING_FILES',
      generationStatus: 'GENERATING',
      updatedAt: now,
      generationAttempt: attempt,
      generationError: null,
      history,
      errorMessage: null,
    }, '#status = :from AND (attribute_not_exists(#gs) OR #gs <> :generating)', {
      ':from': order.status,
      ':generating': 'GENERATING',
    }, {
      '#status': 'status',
      '#gs': 'generationStatus',
    });
  } catch (error) {
    if (errorName(error) === 'ConditionalCheckFailedException') {
      const current = await deps.findByOrderNumber(orderNumber);
      if (!current) throw new Error('Order not found');
      return summary(current);
    }
    console.error('confirmOrder failed', error instanceof Error ? error.name : 'error');
    throw error;
  }
  await deps.enqueueGeneration(order.orderId, attempt);
  return summary({ ...order, status: 'GENERATING_FILES', generationStatus: 'GENERATING', updatedAt: now });
}

export const handler = async (event: AppSyncResolverEvent<{ orderNumber: string; email: string }>) => confirmGeneration({
  findByOrderNumber: (orderNumber) => findByOrderNumber(orderNumber) as Promise<OrderItem | undefined>,
  objectExists,
  updateOrder,
  enqueueGeneration,
}, event.arguments?.orderNumber ?? '', event.arguments?.email ?? '');
