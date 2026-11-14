import type { SQSEvent } from 'aws-lambda';
import { failedEmail } from '../orders/logic';
import { getOrder, notifyOwner, updateOrder } from '../orders/store';
import type { OrderItem } from '../orders/view';

/** Backup for a crash (for example out of memory) that never wrote FAILED. */
export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body) as { orderId?: string };
    if (!message.orderId) continue;
    const order = await getOrder(message.orderId) as OrderItem | undefined;
    if (!order || order.status === 'READY_TO_PRINT' || order.status === 'FAILED') continue;
    const now = new Date().toISOString();
    const note = 'Generation failed after retries. See the generator logs.';
    const history = [...(order.history ?? []), { status: 'FAILED', at: now, actor: 'system', note }];
    await updateOrder(order.orderId, {
      status: 'FAILED',
      updatedAt: now,
      errorMessage: note,
      history,
    }, 'attribute_exists(orderId)');
    await notifyOwner(failedEmail({ orderNumber: order.orderNumber, error: note }).subject, failedEmail({ orderNumber: order.orderNumber, error: note }).text);
  }
};
