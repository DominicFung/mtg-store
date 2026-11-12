import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import type { AppSyncResolverEvent } from 'aws-lambda';
import { fromItem, PrintSettingsRecord } from './model';

const tableName = process.env.PRINT_SETTINGS_TABLE_NAME;

const client = new DynamoDBClient({});

function plainItem(item: Record<string, { S?: string; N?: string }> | undefined): Record<string, unknown> | undefined {
  if (!item) return undefined;
  const plain: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (value.N !== undefined) plain[key] = Number(value.N);
    else if (value.S !== undefined) plain[key] = value.S;
  }
  return plain;
}

export const handler = async (
  event: AppSyncResolverEvent<Record<string, never>>,
): Promise<PrintSettingsRecord> => {
  void event.info?.fieldName;
  if (!tableName) {
    throw new Error('PRINT_SETTINGS_TABLE_NAME is not set');
  }

  const result = await client.send(new GetItemCommand({
    TableName: tableName,
    Key: { settingsId: { S: 'default' } },
  }));

  return fromItem(plainItem(result.Item));
};
