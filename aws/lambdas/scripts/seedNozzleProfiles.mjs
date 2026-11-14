/**
 * Load aws/seeds/nozzleProfiles.json into the nozzle-profile table.
 * The default profile is also written to the existing print-settings table so
 * getPrintSettings stays aligned. Additive: it does not delete other rows.
 *
 * From aws/lambdas, with credentials for us-east-1:
 *   NOZZLE_PROFILES_TABLE_NAME=mtgstore-NozzleProfilesTable \
 *   PRINT_SETTINGS_TABLE_NAME=mtgstore-PrintSettingsTable \
 *   AWS_REGION=us-east-1 \
 *   npm run seed:nozzle-profiles
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const tableName = process.env.NOZZLE_PROFILES_TABLE_NAME;
const printSettingsTable = process.env.PRINT_SETTINGS_TABLE_NAME;
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

if (!tableName) {
  console.error('Set NOZZLE_PROFILES_TABLE_NAME (for example mtgstore-NozzleProfilesTable).');
  process.exit(1);
}
if (!region) {
  console.error('Set AWS_REGION (us-east-1).');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(join(here, '../../seeds/nozzleProfiles.json'), 'utf8'));
if (!Array.isArray(profiles) || profiles.length === 0) {
  console.error('seeds/nozzleProfiles.json is empty.');
  process.exit(1);
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

try {
  for (const profile of profiles) {
    await documentClient.send(new PutCommand({ TableName: tableName, Item: profile }));
    console.log(`Wrote nozzle profile ${profile.profileId} to ${tableName}.`);
  }
  const fallback = profiles.find((profile) => profile.isDefault) ?? profiles[0];
  if (printSettingsTable && fallback) {
    await documentClient.send(new PutCommand({
      TableName: printSettingsTable,
      Item: {
        settingsId: 'default',
        layerHeight: fallback.layerHeight,
        baseLayerHeight: fallback.baseLayerHeight,
        width: fallback.nominalWidth,
        height: fallback.maxHeight,
        nozzleSize: fallback.nozzleSize,
        minDepth: fallback.minDepth,
        maxDepth: fallback.maxDepth,
        borderWidth: fallback.borderWidth,
        borderDepth: fallback.borderDepth,
        detailSize: fallback.detailSize,
      },
    }));
    console.log(`Synced default profile onto ${printSettingsTable}.`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Failed to seed nozzle profiles: ${message}`);
  process.exit(1);
}
