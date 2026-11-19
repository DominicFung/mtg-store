import type { SQSEvent } from 'aws-lambda';
import { failedEmail, fulfillmentPreserved } from '../orders/logic';
import { getOrder, notifyOwner, updateOrder } from '../orders/store';
import type { OrderItem } from '../orders/view';

/** Backup for a crash (for example out of memory) that never wrote FAILED. */
export const handler = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body) as { orderId?: string };
    if (!message.orderId) continue;
    const order = await getOrder(message.orderId) as OrderItem | undefined;
    if (!order || order.generationStatus === 'READY') continue;
    if (order.outputKey && order.generationStatus !== 'GENERATING') continue;
    const now = new Date().toISOString();
    const note = 'Generation failed after retries. See the generator logs.';
    const updates: Record<string, unknown> = {
      generationStatus: 'FAILED',
      generationError: note,
      errorMessage: note,
      updatedAt: now,
    };
    if (!fulfillmentPreserved(order.status)) {
      updates.status = 'FAILED';
      updates.history = [...(order.history ?? []), { status: 'FAILED', at: now, actor: 'system', note }];
    }
    await updateOrder(order.orderId, updates, 'attribute_exists(orderId)');
    const mail = failedEmail({ orderNumber: order.orderNumber, error: note });
    await notifyOwner(mail.subject, mail.text);
  }
};
