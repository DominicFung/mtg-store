import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import type { AppSyncResolverEvent } from 'aws-lambda';
import { assertPrintSettings, PrintSettingsRecord } from './model';

const tableName = process.env.PRINT_SETTINGS_TABLE_NAME;

const client = new DynamoDBClient({});

type Input = {
  layerHeight: number;
  baseLayerHeight: number;
  width: number;
  height: number;
  nozzleSize: number;
};

export const handler = async (
  event: AppSyncResolverEvent<{ input: Input }>,
): Promise<PrintSettingsRecord> => {
  if (!tableName) {
    throw new Error('PRINT_SETTINGS_TABLE_NAME is not set');
  }

  const saved = assertPrintSettings(event.arguments?.input ?? {});
  await client.send(new PutItemCommand({
    TableName: tableName,
    Item: {
      settingsId: { S: saved.id },
      layerHeight: { N: String(saved.layerHeight) },
      baseLayerHeight: { N: String(saved.baseLayerHeight) },
      width: { N: String(saved.width) },
      height: { N: String(saved.height) },
      nozzleSize: { N: String(saved.nozzleSize) },
    },
  }));
  return saved;
};
