/**
 * Load aws/seeds/filaments.json into the filament table.
 *
 * The hex colours and td values in that file are approximate placeholders.
 * Measure each spool, edit the JSON (set approximate to false), then run this again.
 *
 * Usage, from aws/lambdas, with credentials that can write the table:
 *   FILAMENT_TABLE_NAME=mtgstore-FilamentTable AWS_REGION=ca-central-1 npm run seed:filaments
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const tableName = process.env.FILAMENT_TABLE_NAME;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

if (!tableName) {
  console.error('Set FILAMENT_TABLE_NAME (for example mtgstore-FilamentTable).');
  process.exit(1);
}
if (!region) {
  console.error('Set AWS_REGION to the region the stack was deployed in.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(readFileSync(join(here, '../../seeds/filaments.json'), 'utf8'));

if (!Array.isArray(items) || items.length === 0) {
  console.error('seeds/filaments.json did not contain any filaments.');
  process.exit(1);
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

try {
  const result = await documentClient.send(new BatchWriteCommand({
    RequestItems: {
      [tableName]: items.map((Item) => ({ PutRequest: { Item } })),
    },
  }));
  const leftover = result.UnprocessedItems?.[tableName]?.length ?? 0;
  if (leftover > 0) {
    console.error(`DynamoDB left ${leftover} filament writes unprocessed. Run the script again.`);
    process.exit(1);
  }
  console.log(`Wrote ${items.length} filaments to ${tableName}. hex and td are still the approximate placeholders until you edit them.`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to seed filaments: ${message}`);
  process.exit(1);
}
