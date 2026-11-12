export const DEFAULT_PRINT_SETTINGS = {
  id: 'default',
  layerHeight: 0.04,
  baseLayerHeight: 0.09,
  width: 82.44,
  height: 105.45,
  nozzleSize: 0.2,
};

export type PrintSettingsRecord = {
  id: string;
  layerHeight: number;
  baseLayerHeight: number;
  width: number;
  height: number;
  nozzleSize: number;
};

const RANGES = {
  layerHeight: [0.01, 1],
  baseLayerHeight: [0.01, 2],
  width: [10, 400],
  height: [10, 400],
  nozzleSize: [0.1, 1.2],
} as const;

type Field = keyof typeof RANGES;

export function assertPrintSettings(input: Partial<PrintSettingsRecord>): PrintSettingsRecord {
  const result: PrintSettingsRecord = { ...DEFAULT_PRINT_SETTINGS };
  (Object.keys(RANGES) as Field[]).forEach((key) => {
    const value = input[key];
    const [min, max] = RANGES[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} must be a number from ${min} to ${max}`);
    }
    result[key] = value;
  });
  return result;
}

export function fromItem(item: Record<string, unknown> | undefined): PrintSettingsRecord {
  if (!item) return { ...DEFAULT_PRINT_SETTINGS };
  const numeric = (key: Field) => {
    const value = item[key];
    return typeof value === 'number' ? value : Number(value);
  };
  try {
    return assertPrintSettings({
      layerHeight: numeric('layerHeight'),
      baseLayerHeight: numeric('baseLayerHeight'),
      width: numeric('width'),
      height: numeric('height'),
      nozzleSize: numeric('nozzleSize'),
    });
  } catch {
    return { ...DEFAULT_PRINT_SETTINGS };
  }
}
