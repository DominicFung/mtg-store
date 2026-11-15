import { colorCoreLayerCount, layerTopMm } from '../../../packages/print-core/src/hueforge';
import { normalizeLidText } from '../../../packages/print-core/src/lidText';
import { isOrderNumber, newOrderNumber, PAYMENT_STATUS, PRICE_LABEL } from '../../../packages/print-core/src/orderNumber';
import {
  profileToSettings,
  resolveProfile,
  type NozzleProfile,
} from '../../../packages/print-core/src/profiles';
import type { PrintSettings } from '../../../packages/print-core/src/printGeometry';

export const ORDER_STATUSES = [
  'RECEIVED',
  'GENERATING_FILES',
  'READY_TO_PRINT',
  'PRINTING',
  'SHIPPED',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export { PAYMENT_STATUS, PRICE_LABEL };
export const SHOP_PARTITION = 'mana-ramp';

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MIN_IMAGE_BYTES = 64;
export const MAX_EDGE_PX = 8000;
export const MAX_STOPS = 16;
export const ORDERS_PER_HOUR = 5;
export const ORDERS_PER_DAY = 20;
export const PRESIGN_TTL_SECONDS = 4 * 60 * 60;

const ADMIN_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  RECEIVED: ['CANCELLED'],
  GENERATING_FILES: ['CANCELLED'],
  READY_TO_PRINT: ['PRINTING', 'CANCELLED'],
  PRINTING: ['READY_TO_PRINT', 'SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'PRINTING'],
  DELIVERED: [],
  FAILED: ['CANCELLED'],
  CANCELLED: [],
};

const RETRY_FROM: readonly OrderStatus[] = ['FAILED', 'READY_TO_PRINT', 'RECEIVED'];

export type HistoryEntry = {
  status: OrderStatus;
  at: string;
  actor: 'customer' | 'generator' | 'admin' | 'system';
  note?: string;
};

export type OrderStopInput = {
  filamentId: string;
  endLayer: number;
};

export type UploadSlotInput = {
  width: number;
  height: number;
  byteLength: number;
};

export type LidInput = {
  boxFilamentId: string;
  logoFilamentId: string;
  text?: string;
  textFilamentId?: string;
};

/** Filament choices for the shell, the lid, the spark, and the optional name. */
export type LidFinish = {
  boxFilamentId: string;
  boxFilamentName: string;
  boxHex: string;
  logoFilamentId: string;
  logoFilamentName: string;
  logoHex: string;
  text: string | null;
  textFilamentId: string | null;
  textFilamentName: string | null;
  textHex: string | null;
};

export type SubmitInput = {
  clientRequestId: string;
  email: string;
  name: string;
  profileId: string;
  note?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  stops: OrderStopInput[];
  crops: UploadSlotInput[];
  previews: UploadSlotInput[];
  lid?: LidInput;
};

export type CatalogueFilament = {
  id: string;
  name: string;
  hex: string;
  td: number;
  type?: string | null;
  brand?: string | null;
};

export type SnapshottedStop = {
  filamentId: string;
  name: string;
  hex: string;
  td: number;
  type: string;
  brand: string | null;
  endLayer: number;
  depthMm: number;
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ADMIN_TRANSITIONS[from].includes(to)) {
    throw new Error(`Cannot move an order from ${from} to ${to}`);
  }
  if (to === 'SHIPPED') {
    throw new Error('Shipped orders need a carrier and a tracking number');
  }
}

export function assertShipped(from: OrderStatus, carrier: string, trackingNumber: string): { carrier: string; trackingNumber: string } {
  if (!ADMIN_TRANSITIONS[from].includes('SHIPPED') && from !== 'SHIPPED') {
    throw new Error(`Cannot move an order from ${from} to SHIPPED`);
  }
  const cleanCarrier = carrier.trim();
  const cleanTracking = trackingNumber.trim();
  if (cleanCarrier.length < 2 || cleanCarrier.length > 40) throw new Error('Enter the carrier');
  if (cleanTracking.length < 4 || cleanTracking.length > 60) throw new Error('Enter the tracking number');
  return { carrier: cleanCarrier, trackingNumber: cleanTracking };
}

export function canRetry(status: OrderStatus): boolean {
  return RETRY_FROM.includes(status);
}

export function rateLimitMessage(counts: { lastHour: number; lastDay: number }): string | null {
  if (counts.lastHour >= ORDERS_PER_HOUR) {
    return 'Too many orders from this email in the last hour. Try again later.';
  }
  if (counts.lastDay >= ORDERS_PER_DAY) {
    return 'Too many orders from this email today. Try again later.';
  }
  return null;
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') throw new Error(`${label} is required`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  if (trimmed.length > max) throw new Error(`${label} is too long`);
  return trimmed;
}

function optionalText(value: unknown, label: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredText(value, label, max);
}

function assertEmail(value: unknown): string {
  const email = normalizeEmail(requiredText(value, 'Email', 120));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email');
  return email;
}

function assertSlot(value: unknown, label: string): UploadSlotInput {
  if (!value || typeof value !== 'object') throw new Error(`${label} is missing`);
  const slot = value as Record<string, unknown>;
  const width = Number(slot.width);
  const height = Number(slot.height);
  const byteLength = Number(slot.byteLength);
  if (!Number.isInteger(width) || width < 2 || width > MAX_EDGE_PX) throw new Error(`${label} width is invalid`);
  if (!Number.isInteger(height) || height < 2 || height > MAX_EDGE_PX) throw new Error(`${label} height is invalid`);
  if (!Number.isInteger(byteLength) || byteLength < MIN_IMAGE_BYTES || byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${label} must be a PNG under 12 MB`);
  }
  return { width, height, byteLength };
}

export function parseSubmitInput(raw: unknown): SubmitInput {
  if (!raw || typeof raw !== 'object') throw new Error('Order is missing');
  const input = raw as Record<string, unknown>;
  const clientRequestId = requiredText(input.clientRequestId, 'Request id', 80);
  if (!/^[A-Za-z0-9-]{8,80}$/.test(clientRequestId)) throw new Error('Request id is invalid');
  const stopsRaw = input.stops;
  if (!Array.isArray(stopsRaw) || stopsRaw.length < 1 || stopsRaw.length > MAX_STOPS) {
    throw new Error('Choose between 1 and 16 filaments');
  }
  const stops = stopsRaw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Filament ${index + 1} is invalid`);
    const stop = entry as Record<string, unknown>;
    const filamentId = requiredText(stop.filamentId, `Filament ${index + 1}`, 80);
    const endLayer = Number(stop.endLayer);
    if (!Number.isInteger(endLayer) || endLayer < 1 || endLayer > 500) {
      throw new Error(`Filament ${index + 1} has an invalid end layer`);
    }
    return { filamentId, endLayer };
  });
  for (let index = 1; index < stops.length; index += 1) {
    if (stops[index].endLayer <= stops[index - 1].endLayer) {
      throw new Error('Filament layers must move up the colour core');
    }
  }
  const cropsRaw = input.crops;
  const previewsRaw = input.previews;
  if (!Array.isArray(cropsRaw) || cropsRaw.length !== 3) throw new Error('Three face crops are required');
  if (!Array.isArray(previewsRaw) || previewsRaw.length !== 3) throw new Error('Three preview images are required');
  return {
    clientRequestId,
    email: assertEmail(input.email),
    name: requiredText(input.name, 'Name', 80),
    profileId: requiredText(input.profileId, 'Nozzle profile', 40),
    note: optionalText(input.note, 'Note', 500),
    addressLine1: optionalText(input.addressLine1, 'Address', 120),
    city: optionalText(input.city, 'City', 80),
    region: optionalText(input.region, 'Region', 80),
    postalCode: optionalText(input.postalCode, 'Postal code', 20),
    country: optionalText(input.country, 'Country', 80),
    stops,
    crops: cropsRaw.map((slot, index) => assertSlot(slot, `Face ${index + 1}`)),
    previews: previewsRaw.map((slot, index) => assertSlot(slot, `Preview ${index + 1}`)),
    lid: parseLid(input.lid),
  };
}

function parseLid(value: unknown): LidInput | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object') throw new Error('Lid colours are invalid');
  const lid = value as Record<string, unknown>;
  const text = normalizeLidText(lid.text);
  return {
    boxFilamentId: requiredText(lid.boxFilamentId, 'Box colour', 80),
    logoFilamentId: requiredText(lid.logoFilamentId, 'Logo colour', 80),
    text: text || undefined,
    textFilamentId: text ? requiredText(lid.textFilamentId, 'Name colour', 80) : undefined,
  };
}

export function snapshotStops(
  stops: readonly OrderStopInput[],
  catalogue: readonly CatalogueFilament[],
  profile: NozzleProfile,
): SnapshottedStop[] {
  const resolved = resolveProfile(profile);
  const byId = new Map(catalogue.map((filament) => [filament.id, filament]));
  return stops.map((stop, index) => {
    const filament = byId.get(stop.filamentId);
    if (!filament) throw new Error(`Unknown filament on layer ${index + 1}`);
    if (stop.endLayer > resolved.layerCount) {
      throw new Error(`Filament ${index + 1} ends past the ${resolved.layerCount}-layer colour core`);
    }
    return {
      filamentId: filament.id,
      name: filament.name,
      hex: filament.hex,
      td: filament.td,
      type: (filament.type ?? 'PLA').trim() || 'PLA',
      brand: filament.brand ?? null,
      endLayer: stop.endLayer,
      depthMm: layerTopMm(stop.endLayer, profile),
    };
  });
}

export function snapshotLid(lid: LidInput, catalogue: readonly CatalogueFilament[]): LidFinish {
  const byId = new Map(catalogue.map((filament) => [filament.id, filament]));
  const box = byId.get(lid.boxFilamentId);
  const logo = byId.get(lid.logoFilamentId);
  if (!box) throw new Error('Unknown filament for the box colour');
  if (!logo) throw new Error('Unknown filament for the Magic logo');
  const text = lid.text?.trim() ? lid.text.trim() : null;
  const textFilament = text ? byId.get(lid.textFilamentId ?? '') : undefined;
  if (text && !textFilament) throw new Error('Unknown filament for the name on the lid');
  return {
    boxFilamentId: box.id,
    boxFilamentName: box.name,
    boxHex: box.hex,
    logoFilamentId: logo.id,
    logoFilamentName: logo.name,
    logoHex: logo.hex,
    text,
    textFilamentId: textFilament?.id ?? null,
    textFilamentName: textFilament?.name ?? null,
    textHex: textFilament?.hex ?? null,
  };
}

export function lidColourLines(lid: LidFinish): string[] {
  const lines = [
    `Box and lid: ${lid.boxFilamentName} (${lid.boxHex})`,
    `Magic logo: ${lid.logoFilamentName} (${lid.logoHex})`,
  ];
  if (lid.text && lid.textFilamentName) {
    lines.push(`Name on the lid: ${lid.text} in ${lid.textFilamentName} (${lid.textHex})`);
  } else {
    lines.push('Name on the lid: none');
  }
  return lines;
}

export function settingsFromProfile(profile: NozzleProfile): PrintSettings {
  return profileToSettings(profile);
}

export function printSettingsItemFromProfile(profile: NozzleProfile): Record<string, number | string> {
  const settings = profileToSettings(profile);
  return {
    settingsId: 'default',
    layerHeight: settings.layerHeight,
    baseLayerHeight: settings.baseLayerHeight,
    width: settings.width,
    height: settings.height,
    nozzleSize: settings.nozzleSize,
    minDepth: settings.minDepth,
    maxDepth: settings.maxDepth,
    borderWidth: settings.borderWidth,
    borderDepth: settings.borderDepth,
    detailSize: settings.detailSize,
  };
}

export function orderObjectKeys(orderId: string): {
  manifest: string;
  zip: string;
  crops: [string, string, string];
  previews: [string, string, string];
} {
  const prefix = `orders/${orderId}`;
  return {
    manifest: `${prefix}/manifest.json`,
    zip: `${prefix}/output/deck-box.zip`,
    crops: [`${prefix}/inputs/crop-1.png`, `${prefix}/inputs/crop-2.png`, `${prefix}/inputs/crop-3.png`],
    previews: [`${prefix}/inputs/preview-1.png`, `${prefix}/inputs/preview-2.png`, `${prefix}/inputs/preview-3.png`],
  };
}

export function createOrderId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return newOrderNumber().replace('MR-', '');
}

export { isOrderNumber, newOrderNumber, colorCoreLayerCount };

export type GenerationDecision = 'run' | 'skip';

export function generationDecision(order: {
  status: OrderStatus;
  generationAttempt: number;
  outputKey?: string;
}, message: { attempt: number }): GenerationDecision {
  if (message.attempt !== order.generationAttempt) return 'skip';
  if (order.status === 'READY_TO_PRINT' && order.outputKey) return 'skip';
  if (order.status === 'CANCELLED' || order.status === 'DELIVERED' || order.status === 'SHIPPED' || order.status === 'PRINTING') {
    return 'skip';
  }
  if (order.status === 'GENERATING_FILES' || order.status === 'FAILED' || order.status === 'READY_TO_PRINT') return 'run';
  return 'skip';
}

export function readyEmail(input: {
  orderNumber: string;
  name: string;
  downloadUrl: string;
  expiresHours: number;
  lid?: LidFinish | null;
}): { subject: string; text: string } {
  const lines = [
    `${input.name} ordered a Commander Deck Box, ${input.orderNumber}. The print files are ready.`,
    '',
    `Download (link expires in ${input.expiresHours} hours; generate a new one from the admin page):`,
    input.downloadUrl,
    '',
    'The zip holds left.stl, spine.stl, right.stl, a details.txt per face, filament-layers.json, and the six record images.',
  ];
  if (input.lid) {
    lines.push(
      'It also holds box-body.stl, lid-base.stl, and lid-spark.stl. lid-text.stl is included when the lid has a name. lid-colours.txt names the filament for each file.',
      '',
      ...lidColourLines(input.lid),
    );
  }
  lines.push('Payments are not collected in the shop yet.');
  return {
    subject: `Mana Ramp ${input.orderNumber} is ready to print`,
    text: lines.join('\n'),
  };
}

export function failedEmail(input: { orderNumber: string; error: string }): { subject: string; text: string } {
  return {
    subject: `Mana Ramp ${input.orderNumber} failed to generate`,
    text: [
      `${input.orderNumber} did not finish generating print files.`,
      '',
      input.error,
      '',
      'The order is marked FAILED. Retry it from the admin page after checking the generator logs.',
    ].join('\n'),
  };
}

export function customerStatusEmail(input: { orderNumber: string; status: OrderStatus; carrier?: string; trackingNumber?: string }): { subject: string; text: string } {
  const lines = [
    `Your Commander Deck Box ${input.orderNumber} is now ${input.status.replaceAll('_', ' ').toLowerCase()}.`,
  ];
  if (input.status === 'SHIPPED' && input.carrier && input.trackingNumber) {
    lines.push('', `${input.carrier} tracking: ${input.trackingNumber}`);
  }
  lines.push('', 'Track it with this order number and the email you ordered with.');
  return { subject: `Mana Ramp ${input.orderNumber}: ${input.status}`, text: lines.join('\n') };
}

export function appendHistory(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...history, entry];
}
