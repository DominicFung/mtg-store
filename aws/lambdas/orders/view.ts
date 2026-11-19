import { orderObjectKeys, PRICE_LABEL, type OrderStatus } from './logic';
import { presignGet } from './store';

export type OrderItem = Record<string, unknown> & {
  orderId: string;
  orderNumber: string;
  email: string;
  name: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  profileSnapshot?: { name?: string; nozzleSize?: number; layerCount?: number };
  stops?: Array<Record<string, unknown>>;
  history?: Array<Record<string, unknown>>;
  errorMessage?: string;
  carrier?: string;
  trackingNumber?: string;
  outputKey?: string;
  deliveryPhotoKey?: string;
};

export function summary(item: OrderItem) {
  const profile = item.profileSnapshot ?? {};
  return {
    orderId: item.orderId,
    orderNumber: item.orderNumber,
    email: item.email,
    name: item.name,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    priceLabel: typeof item.priceLabel === 'string' ? item.priceLabel : PRICE_LABEL,
    paymentStatus: typeof item.paymentStatus === 'string' ? item.paymentStatus : 'NOT_CONNECTED',
    profileName: profile.name ?? 'Nozzle profile',
    nozzleSize: profile.nozzleSize ?? 0,
    layerCount: profile.layerCount ?? 0,
    errorMessage: item.errorMessage ?? null,
    carrier: item.carrier ?? null,
    trackingNumber: item.trackingNumber ?? null,
    note: typeof item.note === 'string' ? item.note : null,
    addressLine1: typeof item.addressLine1 === 'string' ? item.addressLine1 : null,
    city: typeof item.city === 'string' ? item.city : null,
    region: typeof item.region === 'string' ? item.region : null,
    postalCode: typeof item.postalCode === 'string' ? item.postalCode : null,
    country: typeof item.country === 'string' ? item.country : null,
  };
}

export async function withImages(item: OrderItem, includeDownload: boolean) {
  const keys = orderObjectKeys(item.orderId);
  const previewUrls = await Promise.all(keys.previews.map(async (key) => {
    try {
      return await presignGet(key);
    } catch {
      return '';
    }
  }));
  let downloadUrl: string | null = null;
  let downloadExpiresAt: string | null = null;
  if (includeDownload && item.outputKey) {
    downloadUrl = await presignGet(item.outputKey);
    const ttl = Number(process.env.PRESIGN_TTL_SECONDS ?? 4 * 60 * 60);
    downloadExpiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  }
  const deliveryPhotoUrl = includeDownload && item.status === 'DELIVERED' && item.deliveryPhotoKey
    ? await presignGet(item.deliveryPhotoKey, 60 * 60)
    : null;
  return {
    ...summary(item),
    history: item.history ?? [],
    stops: item.stops ?? [],
    previewUrls: previewUrls.filter(Boolean),
    downloadUrl,
    downloadExpiresAt,
    profileSnapshotJson: JSON.stringify(item.profileSnapshot ?? {}),
    deliveryPhotoUrl,
    lid: lidView(item.lid),
  };
}

function lidView(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const lid = value as Record<string, unknown>;
  if (typeof lid.boxFilamentId !== 'string' || typeof lid.logoFilamentId !== 'string') return null;
  return {
    boxFilamentId: lid.boxFilamentId,
    boxFilamentName: typeof lid.boxFilamentName === 'string' ? lid.boxFilamentName : lid.boxFilamentId,
    boxHex: typeof lid.boxHex === 'string' ? lid.boxHex : '#888888',
    logoFilamentId: lid.logoFilamentId,
    logoFilamentName: typeof lid.logoFilamentName === 'string' ? lid.logoFilamentName : lid.logoFilamentId,
    logoHex: typeof lid.logoHex === 'string' ? lid.logoHex : '#888888',
    text: typeof lid.text === 'string' && lid.text ? lid.text : null,
    textFilamentId: typeof lid.textFilamentId === 'string' ? lid.textFilamentId : null,
    textFilamentName: typeof lid.textFilamentName === 'string' ? lid.textFilamentName : null,
    textHex: typeof lid.textHex === 'string' ? lid.textHex : null,
  };
}
