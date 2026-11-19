import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import type { NozzleProfile } from '../../../packages/print-core/src/profiles';
import { profileFromItem } from '../nozzleProfiles/logic';
import type { CatalogueFilament } from './logic';

export const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const s3 = new S3Client({});
export const sqs = new SQSClient({});
export const ses = new SESClient({});
export const sns = new SNSClient({});

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export async function getProfile(profileId: string): Promise<NozzleProfile | null> {
  const result = await documentClient.send(new GetCommand({
    TableName: requiredEnv('NOZZLE_PROFILES_TABLE_NAME'),
    Key: { profileId },
  }));
  return profileFromItem(result.Item as Record<string, unknown> | undefined);
}

export async function getFilaments(ids: readonly string[]): Promise<CatalogueFilament[]> {
  const unique = [...new Set(ids)];
  const found: CatalogueFilament[] = [];
  for (const id of unique) {
    const result = await documentClient.send(new GetCommand({
      TableName: requiredEnv('FILAMENT_TABLE_NAME'),
      Key: { filamentId: id },
    }));
    const item = result.Item as Record<string, unknown> | undefined;
    if (!item || typeof item.name !== 'string' || typeof item.hex !== 'string' || typeof item.td !== 'number') continue;
    found.push({
      id,
      name: item.name,
      hex: item.hex,
      td: item.td,
      type: typeof item.type === 'string' ? item.type : 'PLA',
      brand: typeof item.brand === 'string' ? item.brand : null,
    });
  }
  return found;
}

export async function countRecentOrders(email: string, sinceIso: string): Promise<number> {
  const result = await documentClient.send(new QueryCommand({
    TableName: requiredEnv('ORDERS_TABLE_NAME'),
    IndexName: 'email-createdAt',
    KeyConditionExpression: 'email = :email AND createdAt >= :since',
    ExpressionAttributeValues: { ':email': email, ':since': sinceIso },
    Select: 'COUNT',
  }));
  return result.Count ?? 0;
}

export async function findByRequest(clientRequestId: string): Promise<Record<string, unknown> | undefined> {
  const result = await documentClient.send(new QueryCommand({
    TableName: requiredEnv('ORDERS_TABLE_NAME'),
    IndexName: 'clientRequestId',
    KeyConditionExpression: 'clientRequestId = :id',
    ExpressionAttributeValues: { ':id': clientRequestId },
    Limit: 1,
  }));
  return result.Items?.[0] as Record<string, unknown> | undefined;
}

export async function findByOrderNumber(orderNumber: string): Promise<Record<string, unknown> | undefined> {
  const result = await documentClient.send(new QueryCommand({
    TableName: requiredEnv('ORDERS_TABLE_NAME'),
    IndexName: 'orderNumber',
    KeyConditionExpression: 'orderNumber = :number',
    ExpressionAttributeValues: { ':number': orderNumber },
    Limit: 1,
  }));
  return result.Items?.[0] as Record<string, unknown> | undefined;
}

export async function getOrder(orderId: string): Promise<Record<string, unknown> | undefined> {
  const result = await documentClient.send(new GetCommand({
    TableName: requiredEnv('ORDERS_TABLE_NAME'),
    Key: { orderId },
  }));
  return result.Item as Record<string, unknown> | undefined;
}

export async function putOrder(item: Record<string, unknown>): Promise<void> {
  await documentClient.send(new PutCommand({
    TableName: requiredEnv('ORDERS_TABLE_NAME'),
    Item: item,
    ConditionExpression: 'attribute_not_exists(orderId)',
  }));
}

export async function putJson(key: string, body: unknown): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Key: key,
    Body: JSON.stringify(body),
    ContentType: 'application/json',
  }));
}

export async function presignPut(key: string, byteLength: number, contentType = 'image/png'): Promise<{ url: string; headers: Record<string, string> }> {
  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Key: key,
    ContentType: contentType,
    ContentLength: byteLength,
  }), { expiresIn: 15 * 60 });
  return {
    url,
    headers: {
      'content-type': contentType,
      'content-length': String(byteLength),
    },
  };
}

export async function presignGet(key: string, expiresIn = Number(process.env.PRESIGN_TTL_SECONDS ?? 4 * 60 * 60), filename?: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/"/g, '')}"` : undefined,
  }), { expiresIn });
}

export async function listOrderOutput(orderId: string): Promise<string[]> {
  const listed = await s3.send(new ListObjectsV2Command({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Prefix: `orders/${orderId}/output/`,
  }));
  return (listed.Contents ?? [])
    .map((item) => item.Key)
    .filter((key): key is string => typeof key === 'string' && !key.endsWith('/'));
}

export async function objectSize(key: string): Promise<number> {
  const head = await s3.send(new HeadObjectCommand({ Bucket: requiredEnv('ORDER_BUCKET_NAME'), Key: key }));
  return Number(head.ContentLength ?? 0);
}

export async function readObjectRange(key: string, start: number, end: number): Promise<Buffer> {
  const result = await s3.send(new GetObjectCommand({
    Bucket: requiredEnv('ORDER_BUCKET_NAME'),
    Key: key,
    Range: `bytes=${start}-${end}`,
  }));
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error('Empty object range');
  return Buffer.from(bytes);
}

/** Put a generated zip. Small results go in one request. Larger ones stream in parts. */
export async function uploadChunks(key: string, produce: (sink: (chunk: Buffer) => Promise<void>) => Promise<void>): Promise<void> {
  const bucket = requiredEnv('ORDER_BUCKET_NAME');
  const pending: Buffer[] = [];
  let pendingBytes = 0;
  let uploadId: string | undefined;
  const parts: { ETag: string; PartNumber: number }[] = [];
  let partNumber = 1;
  const flush = async (force: boolean) => {
    if (!pendingBytes) return;
    if (!force && pendingBytes < 6 * 1024 * 1024) return;
    const body = Buffer.concat(pending);
    pending.length = 0;
    pendingBytes = 0;
    if (!uploadId && !force) {
      const created = await s3.send(new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: 'application/zip',
      }));
      uploadId = created.UploadId;
    }
    if (!uploadId) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/zip' }));
      return;
    }
    const uploaded = await s3.send(new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: body,
    }));
    parts.push({ ETag: uploaded.ETag ?? '', PartNumber: partNumber });
    partNumber += 1;
  };
  try {
    await produce(async (chunk) => {
      pending.push(chunk);
      pendingBytes += chunk.length;
      await flush(false);
    });
    await flush(true);
    if (uploadId) {
      await s3.send(new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts },
      }));
    }
  } catch (error) {
    if (uploadId) {
      await s3.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })).catch(() => undefined);
    }
    throw error;
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: requiredEnv('ORDER_BUCKET_NAME'), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function enqueueGeneration(orderId: string, attempt: number): Promise<void> {
  await sqs.send(new SendMessageCommand({
    QueueUrl: requiredEnv('ORDER_QUEUE_URL'),
    MessageBody: JSON.stringify({ orderId, attempt }),
  }));
}

export async function notifyOwner(subject: string, text: string): Promise<string | undefined> {
  const to = requiredEnv('NOTIFY_EMAIL');
  try {
    await ses.send(new SendEmailCommand({
      Source: to,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: text, Charset: 'UTF-8' } },
      },
    }));
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SES send failed';
    const topic = process.env.NOTIFY_TOPIC_ARN;
    if (!topic) return message;
    try {
      await sns.send(new PublishCommand({
        TopicArn: topic,
        Subject: subject.slice(0, 100),
        Message: `${text}\n\nSES was not used (${message}). Confirm the SES identity, or use this SNS email while the account is still in the sandbox.`,
      }));
      return undefined;
    } catch (snsError) {
      const snsMessage = snsError instanceof Error ? snsError.message : 'SNS publish failed';
      return `${message}; ${snsMessage}`;
    }
  }
}

export async function emailCustomer(to: string, subject: string, text: string): Promise<void> {
  const source = requiredEnv('NOTIFY_EMAIL');
  await ses.send(new SendEmailCommand({
    Source: source,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' } },
    },
  }));
}

export async function notifyCustomer(to: string, subject: string, text: string): Promise<void> {
  if (process.env.CUSTOMER_STATUS_EMAILS !== 'true') return;
  const source = requiredEnv('NOTIFY_EMAIL');
  await ses.send(new SendEmailCommand({
    Source: source,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' } },
    },
  }));
}

export async function scanProfiles(): Promise<NozzleProfile[]> {
  const result = await documentClient.send(new ScanCommand({
    TableName: requiredEnv('NOZZLE_PROFILES_TABLE_NAME'),
  }));
  return (result.Items ?? [])
    .map((item) => profileFromItem(item as Record<string, unknown>))
    .filter((profile): profile is NozzleProfile => profile !== null);
}

export async function putProfile(profile: NozzleProfile): Promise<void> {
  await documentClient.send(new PutCommand({
    TableName: requiredEnv('NOZZLE_PROFILES_TABLE_NAME'),
    Item: { ...profile, profileId: profile.id },
  }));
}

export async function putPrintSettings(item: Record<string, unknown>): Promise<void> {
  await documentClient.send(new PutCommand({
    TableName: requiredEnv('PRINT_SETTINGS_TABLE_NAME'),
    Item: item,
  }));
}

const RESERVED_WORDS = new Set([
  'status', 'name', 'size', 'data', 'timestamp', 'value', 'type', 'comment', 'year', 'order', 'key', 'path',
]);

/** Reserved words left bare in a condition. Aliases (#status) and attribute_exists() are fine. */
export function unaliasedReservedWords(expression: string): string[] {
  const stripped = expression
    .replace(/attribute_(not_)?exists\([^)]*\)/g, ' ')
    .replace(/#[A-Za-z0-9_]+/g, ' ')
    .replace(/:[A-Za-z0-9_]+/g, ' ');
  const words = stripped.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  return [...new Set(words.filter((word) => RESERVED_WORDS.has(word.toLowerCase())))];
}

export async function updateOrder(
  orderId: string,
  updates: Record<string, unknown>,
  condition?: string,
  values?: Record<string, unknown>,
  conditionNames?: Record<string, string>,
): Promise<void> {
  const names: Record<string, string> = { ...(conditionNames ?? {}) };
  const expressionValues: Record<string, unknown> = { ...(values ?? {}) };
  const sets: string[] = [];
  Object.entries(updates).forEach(([key, value], index) => {
    const name = `#f${index}`;
    const placeholder = `:f${index}`;
    names[name] = key;
    expressionValues[placeholder] = value;
    sets.push(`${name} = ${placeholder}`);
  });
  if (condition) {
    const bare = unaliasedReservedWords(condition);
    if (bare.length) {
      throw new Error(`Condition uses reserved word ${bare.join(', ')} without an ExpressionAttributeNames alias`);
    }
  }
  await documentClient.send(new UpdateCommand({
    TableName: requiredEnv('ORDERS_TABLE_NAME'),
    Key: { orderId },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    ExpressionAttributeValues: expressionValues,
    ConditionExpression: condition,
  }));
}

export async function claimOrderNumber(orderNumber: string): Promise<boolean> {
  try {
    await documentClient.send(new PutCommand({
      TableName: requiredEnv('ORDERS_TABLE_NAME'),
      Item: { orderId: `lock#${orderNumber}` },
      ConditionExpression: 'attribute_not_exists(orderId)',
    }));
    return true;
  } catch {
    return false;
  }
}
