import type { AppSyncResolverEvent } from 'aws-lambda';
import { isOrderNumber } from '../../../../packages/print-core/src/orderNumber';
import { normalizeEmail } from '../../orders/logic';
import { findByOrderNumber, presignGet } from '../../orders/store';
import { withImages, type OrderItem } from '../../orders/view';

export const handler = async (event: AppSyncResolverEvent<{ orderNumber: string; email: string }>) => {
  const orderNumber = (event.arguments?.orderNumber ?? '').trim().toUpperCase();
  const email = normalizeEmail(event.arguments?.email ?? '');
  if (!isOrderNumber(orderNumber) || !email) throw new Error('Order not found');
  const order = await findByOrderNumber(orderNumber) as OrderItem | undefined;
  if (!order || order.email !== email || order.orderId.startsWith('lock#')) throw new Error('Order not found');
  const detail = await withImages(order, false);
  return {
    ...detail,
    errorMessage: order.status === 'FAILED' ? 'We hit a problem preparing the print. The shop has been told.' : null,
    downloadUrl: null,
    downloadExpiresAt: null,
    profileSnapshotJson: null,
    deliveryPhotoUrl: order.status === 'DELIVERED' && typeof order.deliveryPhotoKey === 'string'
      ? await presignGet(order.deliveryPhotoKey, 60 * 60)
      : null,
  };
};
