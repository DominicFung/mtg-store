import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { hexToRgb, type CoreStop } from '../../../packages/print-core/src/colourCore';
import { profileToSettings, type NozzleProfile } from '../../../packages/print-core/src/profiles';
import { FACE_NAMES, type FaceName } from '../../../packages/print-core/src/printGeometry';
import { fulfillmentPreserved, generationDecision, orderObjectKeys, failedEmail, type LidFinish } from '../orders/logic';
import { buildLidPrint } from './lidPrint';
import { deliverPaidMail } from '../orders/paidNotice';
import { getOrder, notifyOwner, requiredEnv, s3, updateOrder } from '../orders/store';
import { buildOrderZip, decodePng } from './archive';
import type { OrderItem } from '../orders/view';

const FACES: FaceName[] = [...FACE_NAMES];

function isLidFinish(value: unknown): value is LidFinish {
  if (!value || typeof value !== 'object') return false;
  const lid = value as Record<string, unknown>;
  return typeof lid.boxFilamentId === 'string' && typeof lid.logoFilamentId === 'string' && typeof lid.boxFilamentName === 'string';
}

async function readObject(key: string): Promise<Uint8Array> {
  const result = await s3.send(new GetObjectCommand({ Bucket: requiredEnv('ORDER_BUCKET_NAME'), Key: key }));
  if (!result.Body) throw new Error(`Missing ${key}`);
  return result.Body.transformToByteArray();
}

async function markFailed(order: OrderItem, message: string): Promise<void> {
  const now = new Date().toISOString();
  const note = message.slice(0, 500);
  const updates: Record<string, unknown> = {
    generationStatus: 'FAILED',
    generationError: message.slice(0, 2000),
    errorMessage: message.slice(0, 2000),
    updatedAt: now,
  };
  if (!fulfillmentPreserved(order.status)) {
    updates.status = 'FAILED';
    updates.history = [...(order.history ?? []), { status: 'FAILED', at: now, actor: 'generator', note }];
  }
  await updateOrder(order.orderId, updates, 'attribute_exists(orderId)');
  const mail = failedEmail({ orderNumber: order.orderNumber, error: message });
  const notifyError = await notifyOwner(mail.subject, mail.text);
  if (notifyError) {
    await updateOrder(order.orderId, { notifyError }, 'attribute_exists(orderId)');
  }
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try {
      await processRecord(record.body, Number(record.attributes?.ApproximateReceiveCount ?? '1'));
    } catch (error) {
      console.error(error);
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures };
};

async function processRecord(body: string, receiveCount: number): Promise<void> {
  const message = JSON.parse(body) as { orderId?: string; attempt?: number };
  if (!message.orderId || typeof message.attempt !== 'number') throw new Error('Generation message is invalid');
  const order = await getOrder(message.orderId) as OrderItem | undefined;
  if (!order) throw new Error(`Order ${message.orderId} was not found`);
  const decision = generationDecision({
    status: order.status,
    generationAttempt: Number(order.generationAttempt ?? 0),
    outputKey: order.outputKey,
    generationStatus: typeof order.generationStatus === 'string' ? order.generationStatus : undefined,
  }, { attempt: message.attempt });
  if (decision === 'skip') return;

  try {
    const profile = order.profileSnapshot as NozzleProfile | undefined;
    if (!profile) throw new Error('Order is missing its nozzle profile snapshot');
    const settings = profileToSettings(profile);
    if (order.artSource === 'dragon') settings.maxDepth = 2.01;
    const rawStops = Array.isArray(order.stops) ? order.stops : [];
    const stops: CoreStop[] = rawStops.map((stop) => {
      const row = stop as Record<string, unknown>;
      return {
        filament: {
          type: typeof row.type === 'string' ? row.type : 'PLA',
          brand: typeof row.brand === 'string' ? row.brand : null,
          name: typeof row.name === 'string' ? row.name : 'Filament',
          td: typeof row.td === 'number' ? row.td : 1,
        },
        rgb: hexToRgb(typeof row.hex === 'string' ? row.hex : '#808080'),
        endLayer: typeof row.endLayer === 'number' ? row.endLayer : 1,
      };
    });
    if (stops.length === 0) throw new Error('Order has no filaments');
    const keys = orderObjectKeys(order.orderId);
    const faces = await Promise.all(FACES.map(async (name, index) => {
      const cropPng = await readObject(keys.crops[index]);
      const decoded = decodePng(cropPng);
      return { name, rgba: decoded.rgba, width: decoded.width, height: decoded.height, cropPng };
    }));
    const lid = isLidFinish(order.lid) ? buildLidPrint(order.lid) : null;
    const zip = await buildOrderZip({ orderNumber: order.orderNumber, settings, stops, faces, lid });
    const { facesZipBytes } = await import('../orders/facesZip');
    const facesZip = await facesZipBytes(async (start, end) => zip.subarray(start, end + 1), zip.length);
    await s3.send(new PutObjectCommand({
      Bucket: requiredEnv('ORDER_BUCKET_NAME'),
      Key: keys.zip,
      Body: zip,
      ContentType: 'application/zip',
    }));
    await s3.send(new PutObjectCommand({
      Bucket: requiredEnv('ORDER_BUCKET_NAME'),
      Key: keys.facesZip,
      Body: facesZip,
      ContentType: 'application/zip',
    }));
    const now = new Date().toISOString();
    const firstFiles = !order.outputKey;
    const updates: Record<string, unknown> = {
      generationStatus: 'READY',
      generationError: null,
      outputKey: keys.zip,
      errorMessage: null,
      updatedAt: now,
    };
    if (!fulfillmentPreserved(order.status)) {
      updates.status = 'READY_TO_PRINT';
      updates.history = [...(order.history ?? []), {
        status: 'READY_TO_PRINT',
        at: now,
        actor: 'generator',
        note: firstFiles ? 'Print files are ready' : 'Print files regenerated',
      }];
    }
    await updateOrder(order.orderId, updates, 'generationAttempt = :attempt', { ':attempt': message.attempt });
    if (firstFiles) await deliverPaidMail(order.orderId);
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    if (name === 'ConditionalCheckFailedException') return;
    const messageText = error instanceof Error ? error.message : 'Print generation failed';
    if (receiveCount >= 3) await markFailed(order, messageText);
    throw error;
  }
}
