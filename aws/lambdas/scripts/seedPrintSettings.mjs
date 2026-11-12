/**
 * Load aws/seeds/printSettings.json into the print-settings table.
 *
 * width and height are maximum bounds in millimetres. The deck-box page fits
 * the crop's aspect ratio inside them. layerHeight and baseLayerHeight are
 * millimetres; the first printed layer uses baseLayerHeight.
 *
 * Usage, from aws/lambdas, with credentials that can write the table:
 *   PRINT_SETTINGS_TABLE_NAME=mtgstore-PrintSettingsTable AWS_REGION=ca-central-1 npm run seed:print-settings
 *
 * getPrintSettings returns these same numbers when the row is missing, so the
 * shop works before the first seed. Run this to persist them, or call the
 * updatePrintSettings mutation.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const tableName = process.env.PRINT_SETTINGS_TABLE_NAME;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

if (!tableName) {
  console.error('Set PRINT_SETTINGS_TABLE_NAME (for example mtgstore-PrintSettingsTable).');
  process.exit(1);
}
if (!region) {
  console.error('Set AWS_REGION to the region the stack was deployed in.');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const item = JSON.parse(readFileSync(join(here, '../../seeds/printSettings.json'), 'utf8'));
const required = ['settingsId', 'layerHeight', 'baseLayerHeight', 'width', 'height', 'nozzleSize'];
if (!item || typeof item !== 'object' || required.some((key) => item[key] === undefined)) {
  console.error('seeds/printSettings.json is missing a required field.');
  process.exit(1);
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

try {
  await documentClient.send(new PutCommand({
    TableName: tableName,
    Item: item,
  }));
  console.log(`Wrote print settings ${item.settingsId} to ${tableName}.`);
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to seed print settings: ${message}`);
  process.exit(1);
}
