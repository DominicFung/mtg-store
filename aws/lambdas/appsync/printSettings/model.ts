export const DEFAULT_PRINT_SETTINGS = {
  id: 'default',
  layerHeight: 0.04,
  baseLayerHeight: 0.09,
  width: 82.44,
  height: 105.45,
  nozzleSize: 0.2,
  minDepth: 0.25,
  maxDepth: 2,
  borderWidth: 0,
  borderDepth: 0,
  detailSize: 0.1,
};

export type PrintSettingsRecord = {
  id: string;
  layerHeight: number;
  baseLayerHeight: number;
  width: number;
  height: number;
  nozzleSize: number;
  minDepth: number;
  maxDepth: number;
  borderWidth: number;
  borderDepth: number;
  detailSize: number;
};

const REQUIRED = {
  layerHeight: [0.01, 1],
  baseLayerHeight: [0.01, 2],
  width: [10, 400],
  height: [10, 400],
  nozzleSize: [0.1, 1.2],
} as const;

const OPTIONAL = {
  minDepth: [0.01, 20],
  maxDepth: [0.02, 40],
  borderWidth: [0, 40],
  borderDepth: [0, 40],
  detailSize: [0.02, 2],
} as const;

type RequiredField = keyof typeof REQUIRED;
type OptionalField = keyof typeof OPTIONAL;

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function assertPrintSettings(input: Partial<PrintSettingsRecord>): PrintSettingsRecord {
  const result: PrintSettingsRecord = { ...DEFAULT_PRINT_SETTINGS };
  (Object.keys(REQUIRED) as RequiredField[]).forEach((key) => {
    const value = input[key];
    const [min, max] = REQUIRED[key];
    if (!inRange(value, min, max)) {
      throw new Error(`${key} must be a number from ${min} to ${max}`);
    }
    result[key] = value;
  });
  (Object.keys(OPTIONAL) as OptionalField[]).forEach((key) => {
    const value = input[key];
    if (value === undefined) return;
    const [min, max] = OPTIONAL[key];
    if (!inRange(value, min, max)) {
      throw new Error(`${key} must be a number from ${min} to ${max}`);
    }
    result[key] = value;
  });
  if (result.maxDepth <= result.minDepth) {
    throw new Error('maxDepth must be greater than minDepth');
  }
  return result;
}

export function fromItem(item: Record<string, unknown> | undefined): PrintSettingsRecord {
  if (!item) return { ...DEFAULT_PRINT_SETTINGS };
  const numeric = (key: string) => {
    const value = item[key];
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  try {
    return assertPrintSettings({
      layerHeight: numeric('layerHeight'),
      baseLayerHeight: numeric('baseLayerHeight'),
      width: numeric('width'),
      height: numeric('height'),
      nozzleSize: numeric('nozzleSize'),
      minDepth: numeric('minDepth'),
      maxDepth: numeric('maxDepth'),
      borderWidth: numeric('borderWidth'),
      borderDepth: numeric('borderDepth'),
      detailSize: numeric('detailSize'),
    });
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}
