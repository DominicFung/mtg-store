import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, paginateScan } from '@aws-sdk/lib-dynamodb';
import type { AppSyncResolverEvent } from 'aws-lambda';

const tableName = process.env.FILAMENT_TABLE_NAME;

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type FilamentRow = {
  filamentId?: string;
  name?: string;
  hex?: string;
  td?: number;
  inStock?: boolean;
  brand?: string;
  material?: string;
  finish?: string;
  sortOrder?: number;
  approximate?: boolean;
};

type FilamentResult = {
  id: string;
  name: string;
  hex: string;
  td: number;
  inStock: boolean;
  brand: string | null;
  material: string | null;
  finish: string | null;
  sortOrder: number;
  approximate: boolean;
};

export const handler = async (event: AppSyncResolverEvent<Record<string, never>>): Promise<FilamentResult[]> => {
  if (!tableName) {
    throw new Error('FILAMENT_TABLE_NAME is not set');
  }

  // The resolver takes no arguments. Touch the event so unused-parameter checks stay quiet.
  void event.info?.fieldName;

  const filaments: FilamentResult[] = [];
  const pages = paginateScan({ client: documentClient }, { TableName: tableName });
  for await (const page of pages) {
    for (const item of page.Items ?? []) {
      const row = item as FilamentRow;
      if (!row.filamentId || !row.name || !row.hex || typeof row.td !== 'number' || !Number.isFinite(row.td)) {
        continue;
      }
      filaments.push({
        id: row.filamentId,
        name: row.name,
        hex: row.hex,
        td: row.td,
        inStock: row.inStock !== false,
        brand: row.brand ?? null,
        material: row.material ?? null,
        finish: row.finish ?? null,
        sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
        // Missing flag stays approximate so unmeasured rows are not treated as final.
        approximate: row.approximate !== false,
      });
    }
  }

  filaments.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return filaments;
};
