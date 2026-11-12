import Fuse from 'fuse.js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, type ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { AppSyncResolverEvent } from 'aws-lambda';

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export type CardRecord = {
  id: string;
  name: string;
  isRamp: boolean;
};

type CardRow = Record<string, unknown>;

export type CardPage = Pick<ScanCommandOutput, 'Items' | 'LastEvaluatedKey'>;

export type CardScanClient = {
  send(command: ScanCommand): Promise<CardPage>;
};

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// Rows may use the GraphQL names (id, name) or the table keys (cardId, cardName).
export function toCard(row: CardRow): CardRecord | undefined {
  const name = stringField(row.name) ?? stringField(row.cardName);
  if (!name) {
    return undefined;
  }
  return {
    id: stringField(row.id) ?? stringField(row.cardId) ?? name,
    name,
    isRamp: row.isRamp === true,
  };
}

export function searchCardsByName(cards: CardRecord[], searchName: string): CardRecord[] {
  const fuse = new Fuse(cards, {
    keys: ['name'],
    threshold: 0.4,
  });
  return fuse.search(searchName).map((result) => result.item);
}

export async function searchCardByName(
  event: AppSyncResolverEvent<{ name: string }>,
  client: CardScanClient = documentClient as unknown as CardScanClient,
): Promise<CardRecord[]> {
  // CARD_TABLE_NAME is mtgstore-CardTable, the table this function's role can read.
  const tableName = process.env.CARD_TABLE_NAME;
  if (!tableName) {
    throw new Error('CARD_TABLE_NAME is not set');
  }

  const cards: CardRecord[] = [];
  let exclusiveStartKey: CardPage['LastEvaluatedKey'];
  do {
    const page = await client.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: exclusiveStartKey,
    }));
    for (const item of page.Items ?? []) {
      const card = toCard(item);
      if (card) {
        cards.push(card);
      }
    }
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return searchCardsByName(cards, event.arguments.name);
}

export const handler = (
  event: AppSyncResolverEvent<{ name: string }>,
): Promise<CardRecord[]> => searchCardByName(event);