import { normalizeLidText } from '../../../packages/print-core/src/lidText';
import { layerTopMm } from './colourCore';
import type { Filament } from './filamentCatalogue';
import type { NozzleProfile, ResolvedProfile } from './printGeometry';
import { LAUNCH_PROFILES, profileToSettings, resolveProfile } from './printGeometry';
import { newOrderNumber, PAYMENT_STATUS, PRICE_LABEL } from '../../../packages/print-core/src/orderNumber';
import type { ExtendSide, SubjectBounds } from '../../../packages/print-core/src/outpaint';
import { PAYMENTS_NOT_CONFIGURED } from '../../../packages/print-core/src/stripeReady';
import { cardPaymentsReady, publicConfig } from './publicConfig';

export type OutpaintArt = {
  image: string;
  source: string;
  side: ExtendSide;
  subject: SubjectBounds;
};

export type ShopStop = {
  filamentId: string;
  name: string;
  hex: string;
  td: number;
  type?: string;
  brand?: string | null;
  endLayer: number;
  depthMm: number;
};

export type ShopHistory = { status: string; at: string; actor: string; note?: string };

export type ShopOrder = {
  orderId: string;
  orderNumber: string;
  email: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  priceLabel: string;
  paymentStatus: string;
  profileName: string;
  nozzleSize: number;
  layerCount: number;
  stops: ShopStop[];
  previews: string[];
  history: ShopHistory[];
  note?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  errorMessage?: string;
  carrier?: string;
  trackingNumber?: string;
  downloadUrl?: string;
  lid?: ShopLid | null;
};

export type ShopLid = {
  boxFilamentId: string;
  boxFilamentName: string;
  boxHex: string;
  logoFilamentId: string;
  logoFilamentName: string;
  logoHex: string;
  text?: string | null;
  textFilamentId?: string | null;
  textFilamentName?: string | null;
  textHex?: string | null;
};

export type LidChoice = {
  box: Filament;
  logo: Filament;
  textFilament: Filament;
  text: string;
};

export function lidFromChoice(choice: LidChoice): ShopLid {
  let text = '';
  try {
    text = normalizeLidText(choice.text);
  } catch {
    text = choice.text.trim().slice(0, 20);
  }
  return {
    boxFilamentId: choice.box.id,
    boxFilamentName: choice.box.name,
    boxHex: choice.box.hex,
    logoFilamentId: choice.logo.id,
    logoFilamentName: choice.logo.name,
    logoHex: choice.logo.hex,
    text: text || null,
    textFilamentId: text ? choice.textFilament.id : null,
    textFilamentName: text ? choice.textFilament.name : null,
    textHex: text ? choice.textFilament.hex : null,
  };
}

const ORDER_KEY = 'mtg-shop-orders';
const PROFILE_KEY = 'mtg-shop-profiles';
const TOKEN_KEY = 'mtg-admin-token';

export function shopConfigured(): boolean {
  return Boolean(publicConfig.appsyncUrl && publicConfig.appsyncApiKey);
}

export function adminConfigured(): boolean {
  return Boolean(publicConfig.cognitoClientId && publicConfig.cognitoUserPoolId);
}

function readOrders(): ShopOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ORDER_KEY) || '[]') as ShopOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: ShopOrder[]) {
  window.sessionStorage.setItem(ORDER_KEY, JSON.stringify(orders));
}

function ensureSamples() {
  const current = readOrders();
  if (current.some((order) => order.orderId.startsWith('sample-'))) return;
  const now = new Date().toISOString();
  const samples: ShopOrder[] = [
    sample('sample-printing', 'MR-SAMPLE01', 'PRINTING', 'Casey', 'casey@example.com', now),
    sample('sample-shipped', 'MR-SAMPLE02', 'SHIPPED', 'Nissa', 'nissa@example.com', now),
  ];
  writeOrders([...samples, ...current]);
}

function sample(id: string, orderNumber: string, status: string, name: string, email: string, now: string): ShopOrder {
  const profile = resolveProfile(LAUNCH_PROFILES[0]);
  return {
    orderId: id,
    orderNumber,
    email,
    name,
    status,
    createdAt: now,
    updatedAt: now,
    priceLabel: PRICE_LABEL,
    paymentStatus: PAYMENT_STATUS,
    profileName: profile.name,
    nozzleSize: profile.nozzleSize,
    layerCount: profile.layerCount,
    stops: [],
    previews: [],
    history: [{ status, at: now, actor: 'system', note: 'Sample order for the admin preview' }],
    addressLine1: '1 Ravnica',
    city: 'Toronto',
    country: 'Canada',
    carrier: status === 'SHIPPED' ? 'Canada Post' : undefined,
    trackingNumber: status === 'SHIPPED' ? 'CP123456789CA' : undefined,
  };
}

export type PlaceOrderInput = {
  email: string;
  name: string;
  note?: string;
  addressLine1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  profile: ResolvedProfile;
  layers: Filament[];
  stops: number[];
  crops: [string, string, string];
  previews: [string, string, string];
  lid?: LidChoice;
};

function stopsFrom(layers: Filament[], endLayers: number[], profile: ResolvedProfile): ShopStop[] {
  return layers.map((layer, index) => ({
    filamentId: layer.id,
    name: layer.name,
    hex: layer.hex,
    td: layer.td,
    type: layer.type ?? 'PLA',
    brand: layer.brand,
    endLayer: endLayers[index] ?? profile.layerCount,
    depthMm: layerTopMm(endLayers[index] ?? profile.layerCount, profileToSettings(profile)),
  }));
}

/**
 * Always goes through the same-origin route, which returns a data URL.
 * The browser never receives the Scryfall or S3 address, so the crop canvas
 * cannot be tainted. `side` forces the other edge; omit it to let the
 * subject pick. The other side is generated only when this is called again.
 */
export async function outpaintArt(imageUrl: string, side?: ExtendSide): Promise<OutpaintArt> {
  const response = await fetch('/api/outpaint', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageUrl, side: side ?? null }),
  });
  const body = await response.json() as {
    image?: string;
    source?: string;
    side?: string;
    subject?: SubjectBounds;
    error?: string;
  };
  if (!response.ok || !body.image || !body.subject) throw new Error(body.error || 'Could not extend the artwork');
  return {
    image: body.image,
    source: body.source ?? 'edge-extend',
    side: body.side === 'left' ? 'left' : 'right',
    subject: body.subject,
  };
}

export async function placeOrder(input: PlaceOrderInput): Promise<ShopOrder> {
  if (shopConfigured()) return placeRemote(input);
  ensureSamples();
  const now = new Date().toISOString();
  const order: ShopOrder = {
    orderId: crypto.randomUUID(),
    orderNumber: newOrderNumber(),
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    status: 'RECEIVED',
    createdAt: now,
    updatedAt: now,
    priceLabel: PRICE_LABEL,
    paymentStatus: PAYMENT_STATUS,
    profileName: input.profile.name,
    nozzleSize: input.profile.nozzleSize,
    layerCount: input.profile.layerCount,
    stops: stopsFrom(input.layers, input.stops, input.profile),
    previews: [...input.previews],
    history: [{ status: 'RECEIVED', at: now, actor: 'customer', note: 'Order placed' }],
    note: input.note,
    addressLine1: input.addressLine1,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    country: input.country,
    lid: input.lid ? lidFromChoice(input.lid) : null,
  };
  writeOrders([order, ...readOrders()]);
  return order;
}

export async function startCardPayment(order: { orderNumber: string; email: string }): Promise<string> {
  if (!cardPaymentsReady()) throw new Error(PAYMENTS_NOT_CONFIGURED);
  const response = await fetch(publicConfig.paymentsUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      orderNumber: order.orderNumber,
      email: order.email,
      successUrl: `${window.location.origin}/receipt?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(order.email)}`,
      cancelUrl: `${window.location.origin}/box`,
    }),
  });
  const body = await response.json() as { url?: string; message?: string };
  if (!response.ok || !body.url) throw new Error(body.message || PAYMENTS_NOT_CONFIGURED);
  return body.url;
}

export async function trackOrder(orderNumber: string, email: string): Promise<ShopOrder | null> {
  const number = orderNumber.trim().toUpperCase();
  const normalized = email.trim().toLowerCase();
  if (shopConfigured()) {
    const detail = await gql<{ trackOrder: ShopOrder & { previewUrls?: string[] } }>(
      `query Track($orderNumber: String!, $email: String!) {
        trackOrder(orderNumber: $orderNumber, email: $email) {
          orderId orderNumber email name status createdAt updatedAt priceLabel paymentStatus
          profileName nozzleSize layerCount errorMessage carrier trackingNumber note
          addressLine1 city region postalCode country previewUrls
          history { status at actor note }
          stops { filamentId name hex td type brand endLayer depthMm }
          lid { boxFilamentId boxFilamentName boxHex logoFilamentId logoFilamentName logoHex text textFilamentId textFilamentName textHex }
        }
      }`,
      { orderNumber: number, email: normalized },
      'key',
    );
    const order = detail.trackOrder;
    return { ...order, previews: order.previewUrls ?? [] };
  }
  ensureSamples();
  return readOrders().find((order) => order.orderNumber === number && order.email === normalized) ?? null;
}

export async function listShopOrders(filter: { status?: string; email?: string }): Promise<ShopOrder[]> {
  if (shopConfigured() && adminToken()) {
    const rows = await gql<{ listOrders: ShopOrder[] }>(
      `query List($status: String, $email: String) {
        listOrders(status: $status, email: $email, limit: 50) {
          orderId orderNumber email name status createdAt updatedAt priceLabel paymentStatus
          profileName nozzleSize layerCount errorMessage carrier trackingNumber note
          addressLine1 city region postalCode country
        }
      }`,
      { status: filter.status || null, email: filter.email || null },
      'admin',
    );
    return rows.listOrders.map((order) => ({ ...order, previews: [], history: order.history ?? [], stops: order.stops ?? [] }));
  }
  ensureSamples();
  return readOrders().filter((order) => {
    if (filter.status && order.status !== filter.status) return false;
    if (filter.email && !order.email.includes(filter.email.trim().toLowerCase())) return false;
    return true;
  });
}

export async function loadOrder(orderId: string): Promise<ShopOrder | null> {
  if (shopConfigured() && adminToken()) {
    const detail = await gql<{ getAdminOrder: ShopOrder & { previewUrls?: string[] } }>(
      `query Get($orderId: ID!) {
        getAdminOrder(orderId: $orderId) {
          orderId orderNumber email name status createdAt updatedAt priceLabel paymentStatus
          profileName nozzleSize layerCount errorMessage carrier trackingNumber note
          addressLine1 city region postalCode country previewUrls downloadUrl
          history { status at actor note }
          stops { filamentId name hex td type brand endLayer depthMm }
          lid { boxFilamentId boxFilamentName boxHex logoFilamentId logoFilamentName logoHex text textFilamentId textFilamentName textHex }
        }
      }`,
      { orderId },
      'admin',
    );
    const order = detail.getAdminOrder;
    return { ...order, previews: order.previewUrls ?? [] };
  }
  ensureSamples();
  return readOrders().find((order) => order.orderId === orderId) ?? null;
}

export async function updateShopStatus(orderId: string, nextStatus: string, extra: { carrier?: string; trackingNumber?: string; note?: string }): Promise<void> {
  if (shopConfigured() && adminToken()) {
    await gql(
      `mutation Update($orderId: ID!, $nextStatus: String!, $carrier: String, $trackingNumber: String, $note: String) {
        updateOrderStatus(orderId: $orderId, nextStatus: $nextStatus, carrier: $carrier, trackingNumber: $trackingNumber, note: $note) { orderId status }
      }`,
      { orderId, nextStatus, ...extra },
      'admin',
    );
    return;
  }
  const orders = readOrders();
  writeOrders(orders.map((order) => {
    if (order.orderId !== orderId) return order;
    const now = new Date().toISOString();
    return {
      ...order,
      status: nextStatus,
      updatedAt: now,
      carrier: extra.carrier || order.carrier,
      trackingNumber: extra.trackingNumber || order.trackingNumber,
      history: [...order.history, { status: nextStatus, at: now, actor: 'admin', note: extra.note }],
    };
  }));
}

export async function retryShopOrder(orderId: string): Promise<void> {
  if (shopConfigured() && adminToken()) {
    await gql(
      `mutation Retry($orderId: ID!) { retryOrderGeneration(orderId: $orderId) { orderId status } }`,
      { orderId },
      'admin',
    );
    return;
  }
  await updateShopStatus(orderId, 'GENERATING_FILES', { note: 'Retry generation' });
}

export async function refreshShopDownload(orderId: string): Promise<string | undefined> {
  if (!(shopConfigured() && adminToken())) return undefined;
  const detail = await gql<{ refreshDownloadLinks: { downloadUrl?: string } }>(
    `mutation Refresh($orderId: ID!) { refreshDownloadLinks(orderId: $orderId) { downloadUrl } }`,
    { orderId },
    'admin',
  );
  return detail.refreshDownloadLinks.downloadUrl ?? undefined;
}

export function readProfiles(): ResolvedProfile[] {
  if (typeof window === 'undefined') return LAUNCH_PROFILES.map(resolveProfile);
  try {
    const raw = window.sessionStorage.getItem(PROFILE_KEY);
    if (!raw) return LAUNCH_PROFILES.map(resolveProfile);
    const parsed = JSON.parse(raw) as NozzleProfile[];
    return parsed.map(resolveProfile);
  } catch {
    return LAUNCH_PROFILES.map(resolveProfile);
  }
}

export async function listActiveProfiles(): Promise<ResolvedProfile[]> {
  if (!shopConfigured()) return readProfiles().filter((profile) => profile.active);
  try {
    const body = await gql<{ listActiveNozzleProfiles: NozzleProfile[] }>(
      `query Profiles { listActiveNozzleProfiles { ${PROFILE_FIELDS} } }`,
      {},
      'key',
    );
    if (!body.listActiveNozzleProfiles?.length) return readProfiles().filter((profile) => profile.active);
    return body.listActiveNozzleProfiles.map(resolveProfile);
  } catch {
    return readProfiles().filter((profile) => profile.active);
  }
}

export async function saveProfile(profile: NozzleProfile): Promise<void> {
  if (shopConfigured() && adminToken()) {
    await gql(
      `mutation Save($input: UpsertNozzleProfileInput!) { upsertNozzleProfile(input: $input) { id } }`,
      { input: profile },
      'admin',
    );
    return;
  }
  const profiles = readProfiles().map((entry) => (
    profile.isDefault && entry.id !== profile.id ? { ...entry, isDefault: false } : entry
  ));
  const next = profiles.some((entry) => entry.id === profile.id)
    ? profiles.map((entry) => (entry.id === profile.id ? resolveProfile(profile) : entry))
    : [...profiles, resolveProfile(profile)];
  window.sessionStorage.setItem(PROFILE_KEY, JSON.stringify(next));
}

export async function deactivateProfile(id: string): Promise<void> {
  if (shopConfigured() && adminToken()) {
    await gql(
      `mutation Off($id: ID!) { deactivateNozzleProfile(id: $id) { id active } }`,
      { id },
      'admin',
    );
    return;
  }
  const profiles = readProfiles().map((profile) => (
    profile.id === id ? { ...profile, active: false } : profile
  ));
  window.sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
}

export function adminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export async function adminSignIn(email: string, password: string): Promise<void> {
  const clientId = publicConfig.cognitoClientId;
  const region = publicConfig.awsRegion || 'us-east-1';
  if (!clientId) throw new Error('Cognito is not configured in this session');
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  });
  const body = await response.json() as { message?: string; ChallengeName?: string; AuthenticationResult?: { IdToken?: string } };
  if (!response.ok) throw new Error(body.message || 'Sign-in failed');
  if (body.ChallengeName || !body.AuthenticationResult?.IdToken) {
    throw new Error('Set a permanent password with the admin CLI, then sign in again.');
  }
  window.sessionStorage.setItem(TOKEN_KEY, body.AuthenticationResult.IdToken);
}

export function adminSignOut() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

const PROFILE_FIELDS = `
  id name nozzleSize layerHeight baseLayerHeight detailSize minDepth maxDepth
  borderWidth borderDepth brightnessAdjust maxWidth maxHeight nominalWidth
  active isDefault layerCount layersAtMaxDepth coreTopMm
`;

async function placeRemote(input: PlaceOrderInput): Promise<ShopOrder> {
  const clientRequestId = crypto.randomUUID();
  const crops = await Promise.all(input.crops.map(describeImage));
  const previews = await Promise.all(input.previews.map(describeImage));
  const created = await gql<{ submitOrder: { orderId: string; orderNumber: string; uploads: Array<{ purpose: string; url: string; headersJson: string }> } }>(
    `mutation Submit($input: SubmitOrderInput!) {
      submitOrder(input: $input) {
        orderId orderNumber
        uploads { purpose url headersJson }
      }
    }`,
    {
      input: {
        clientRequestId,
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        profileId: input.profile.id,
        note: input.note || null,
        addressLine1: input.addressLine1 || null,
        city: input.city || null,
        region: input.region || null,
        postalCode: input.postalCode || null,
        country: input.country || null,
        stops: input.layers.map((layer, index) => ({
          filamentId: layer.id,
          endLayer: input.stops[index] ?? input.profile.layerCount,
        })),
        crops: crops.map(({ width, height, byteLength }) => ({ width, height, byteLength })),
        previews: previews.map(({ width, height, byteLength }) => ({ width, height, byteLength })),
        lid: input.lid ? {
          boxFilamentId: input.lid.box.id,
          logoFilamentId: input.lid.logo.id,
          text: normalizeLidText(input.lid.text) || null,
          textFilamentId: normalizeLidText(input.lid.text) ? input.lid.textFilament.id : null,
        } : null,
      },
    },
    'key',
  );
  const byPurpose = new Map(created.submitOrder.uploads.map((upload) => [upload.purpose, upload]));
  const files = [
    ['crop-1', crops[0]], ['crop-2', crops[1]], ['crop-3', crops[2]],
    ['preview-1', previews[0]], ['preview-2', previews[1]], ['preview-3', previews[2]],
  ] as const;
  for (const [purpose, file] of files) {
    const upload = byPurpose.get(purpose);
    if (!upload) throw new Error(`Missing upload for ${purpose}`);
    const response = await fetch(upload.url, {
      method: 'PUT',
      headers: JSON.parse(upload.headersJson) as Record<string, string>,
      body: new Blob([file.bytes as BlobPart], { type: 'image/png' }),
    });
    if (!response.ok) throw new Error(`Upload failed for ${purpose}`);
  }
  await gql(
    `mutation Confirm($orderNumber: String!, $email: String!) {
      confirmOrder(orderNumber: $orderNumber, email: $email) { orderId status }
    }`,
    { orderNumber: created.submitOrder.orderNumber, email: input.email.trim().toLowerCase() },
    'key',
  );
  const tracked = await trackOrder(created.submitOrder.orderNumber, input.email);
  if (!tracked) throw new Error('The order was submitted but could not be loaded');
  return { ...tracked, previews: tracked.previews.length ? tracked.previews : [...input.previews] };
}

async function describeImage(dataUrl: string): Promise<{ bytes: Uint8Array; width: number; height: number; byteLength: number }> {
  const bytes = dataUrlToBytes(dataUrl);
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return { bytes, width: image.naturalWidth, height: image.naturalHeight, byteLength: bytes.byteLength };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:[^;,]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('The face image was not a PNG');
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gql<T>(query: string, variables: unknown, auth: 'key' | 'admin'): Promise<T> {
  const url = publicConfig.appsyncUrl;
  if (!url) throw new Error('The shop API is not configured');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth === 'admin') {
    const token = adminToken();
    if (!token) throw new Error('Sign in as the shop admin');
    headers.Authorization = token;
  } else {
    const apiKey = publicConfig.appsyncApiKey;
    if (!apiKey) throw new Error('The shop API is not configured');
    headers['x-api-key'] = apiKey;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (body.errors?.length) throw new Error(body.errors[0].message || 'The shop API rejected the request');
  if (!body.data) throw new Error('The shop API returned no data');
  return body.data;
}
