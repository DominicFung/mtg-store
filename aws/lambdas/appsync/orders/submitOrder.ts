import type { AppSyncResolverEvent } from 'aws-lambda';
import { resolveProfile } from '../../../../packages/print-core/src/profiles';
import { newOrderNumber } from '../../../../packages/print-core/src/orderNumber';
import {
  createOrderId,
  orderObjectKeys,
  parseSubmitInput,
  PAYMENT_STATUS,
  PRICE_LABEL,
  rateLimitMessage,
  SHOP_PARTITION,
  snapshotLid,
  snapshotStops,
  type HistoryEntry,
} from '../../orders/logic';
import {
  claimOrderNumber,
  countRecentOrders,
  findByRequest,
  getFilaments,
  getProfile,
  presignPut,
  putJson,
  putOrder,
} from '../../orders/store';
import { summary, type OrderItem } from '../../orders/view';

async function uploadTargets(orderId: string, crops: { byteLength: number }[], previews: { byteLength: number }[]) {
  const keys = orderObjectKeys(orderId);
  const slots = [
    ...keys.crops.map((key, index) => ({ purpose: `crop-${index + 1}`, key, byteLength: crops[index].byteLength })),
    ...keys.previews.map((key, index) => ({ purpose: `preview-${index + 1}`, key, byteLength: previews[index].byteLength })),
  ];
  return Promise.all(slots.map(async (slot) => {
    const signed = await presignPut(slot.key, slot.byteLength);
    return { purpose: slot.purpose, url: signed.url, headersJson: JSON.stringify(signed.headers) };
  }));
}

export const handler = async (event: AppSyncResolverEvent<{ input: unknown }>) => {
  const input = parseSubmitInput(event.arguments?.input);
  const existing = await findByRequest(input.clientRequestId) as OrderItem | undefined;
  if (existing) {
    if (existing.email !== input.email) throw new Error('This request id is already used');
    const uploads = existing.status === 'RECEIVED'
      ? await uploadTargets(existing.orderId, input.crops, input.previews)
      : [];
    return { ...summary(existing), uploads };
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [lastHour, lastDay] = await Promise.all([
    countRecentOrders(input.email, hourAgo),
    countRecentOrders(input.email, dayAgo),
  ]);
  const limited = rateLimitMessage({ lastHour, lastDay });
  if (limited) throw new Error(limited);

  const profile = await getProfile(input.profileId);
  if (!profile || !profile.active) throw new Error('That nozzle profile is not available');
  const resolved = resolveProfile(profile);
  const filamentIds = input.stops.map((stop) => stop.filamentId);
  if (input.lid) {
    filamentIds.push(input.lid.boxFilamentId, input.lid.logoFilamentId);
    if (input.lid.textFilamentId) filamentIds.push(input.lid.textFilamentId);
  }
  const filaments = await getFilaments(filamentIds);
  const stops = snapshotStops(input.stops, filaments, profile);
  const lid = input.lid ? snapshotLid(input.lid, filaments) : undefined;
  const now = new Date().toISOString();
  const orderId = createOrderId();
  let orderNumber = newOrderNumber();
  let claimed = await claimOrderNumber(orderNumber);
  for (let attempt = 0; attempt < 4 && !claimed; attempt += 1) {
    orderNumber = newOrderNumber();
    claimed = await claimOrderNumber(orderNumber);
  }
  if (!claimed) throw new Error('Could not assign an order number. Try again.');
  const history: HistoryEntry[] = [{ status: 'RECEIVED', at: now, actor: 'customer', note: 'Order placed' }];
  const item: OrderItem = {
    orderId,
    orderNumber,
    clientRequestId: input.clientRequestId,
    email: input.email,
    name: input.name,
    shop: SHOP_PARTITION,
    status: 'RECEIVED',
    createdAt: now,
    updatedAt: now,
    priceLabel: PRICE_LABEL,
    // PAYMENT_HOOK: replace NOT_CONNECTED with a payment intent before confirmOrder.
    paymentStatus: PAYMENT_STATUS,
    note: input.note,
    addressLine1: input.addressLine1,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
    profileSnapshot: resolved,
    stops,
    lid,
    history,
    generationAttempt: 0,
    crops: input.crops,
    previews: input.previews,
  };
  await putOrder(item);
  await putJson(orderObjectKeys(orderId).manifest, {
    orderId,
    orderNumber,
    email: input.email,
    profile: resolved,
    stops,
    lid: lid ?? null,
    crops: input.crops,
    createdAt: now,
    paymentStatus: PAYMENT_STATUS,
  });
  const uploads = await uploadTargets(orderId, input.crops, input.previews);
  return { ...summary(item), uploads };
};
