import { colorCoreLayerCount, layerForDepth, layerTopMm } from '../../../packages/print-core/src/colourCore';
import { LAUNCH_PROFILES, type NozzleProfile } from '../../../packages/print-core/src/profiles';

const RANGES = {
  nozzleSize: [0.1, 1.2],
  layerHeight: [0.01, 1],
  baseLayerHeight: [0.01, 2],
  detailSize: [0.02, 1],
  minDepth: [0.01, 20],
  maxDepth: [0.02, 40],
  borderWidth: [0, 40],
  borderDepth: [0, 40],
  brightnessAdjust: [-1, 1],
  smoothing: [0, 20],
  maxWidth: [10, 400],
  maxHeight: [10, 400],
  nominalWidth: [10, 400],
} as const;

type NumericField = keyof typeof RANGES;

export type ProfileInput = {
  id?: string;
  name: string;
  nozzleSize: number;
  layerHeight: number;
  baseLayerHeight: number;
  detailSize: number;
  minDepth: number;
  maxDepth: number;
  borderWidth: number;
  borderDepth: number;
  brightnessAdjust: number;
  smoothing: number;
  maxWidth: number;
  maxHeight: number;
  nominalWidth: number;
  active: boolean;
  isDefault: boolean;
};

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function parseProfileInput(raw: unknown): ProfileInput {
  if (!raw || typeof raw !== 'object') throw new Error('Profile is missing');
  const input = raw as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length > 40) throw new Error('Profile name is required');
  const result = { name } as ProfileInput;
  (Object.keys(RANGES) as NumericField[]).forEach((key) => {
    const [min, max] = RANGES[key];
    const value = input[key];
    if (!inRange(value, min, max)) throw new Error(`${key} must be a number from ${min} to ${max}`);
    result[key] = value;
  });
  if (result.maxDepth <= result.minDepth) throw new Error('maxDepth must be greater than minDepth');
  if (result.maxHeight < result.minDepth) throw new Error('maxHeight must be at least minDepth');
  result.active = input.active !== false;
  result.isDefault = input.isDefault === true;
  if (input.id !== undefined && input.id !== null && input.id !== '') {
    if (typeof input.id !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,40}$/.test(input.id)) {
      throw new Error('Profile id must be a short lowercase slug');
    }
    result.id = input.id;
  }
  if (result.isDefault && !result.active) throw new Error('The default profile stays active');
  return result;
}

export function toNozzleProfile(input: ProfileInput, id: string): NozzleProfile {
  return {
    id,
    name: input.name,
    nozzleSize: input.nozzleSize,
    layerHeight: input.layerHeight,
    baseLayerHeight: input.baseLayerHeight,
    detailSize: input.detailSize,
    minDepth: input.minDepth,
    maxDepth: input.maxDepth,
    borderWidth: input.borderWidth,
    borderDepth: input.borderDepth,
    brightnessAdjust: input.brightnessAdjust,
    smoothing: input.smoothing,
    maxWidth: input.maxWidth,
    maxHeight: input.maxHeight,
    nominalWidth: input.nominalWidth,
    active: input.active,
    isDefault: input.isDefault,
  };
}

export function profileView(profile: NozzleProfile) {
  const layerCount = colorCoreLayerCount(profile);
  return {
    ...profile,
    layerCount,
    layersAtMaxDepth: layerForDepth(profile.maxDepth, profile),
    coreTopMm: layerTopMm(layerCount, profile),
  };
}

export function publicProfiles(profiles: readonly NozzleProfile[]) {
  return profiles
    .filter((profile) => profile.active)
    .map(profileView)
    .sort((left, right) => left.nozzleSize - right.nozzleSize || left.name.localeCompare(right.name));
}

export function assertCanDeactivate(profile: NozzleProfile): void {
  if (profile.isDefault) throw new Error('Choose another default before deactivating this profile');
}

export const SEEDED_PROFILES: readonly NozzleProfile[] = LAUNCH_PROFILES;

export function profileFromItem(item: Record<string, unknown> | undefined): NozzleProfile | null {
  if (!item) return null;
  const id = typeof item.profileId === 'string' ? item.profileId : typeof item.id === 'string' ? item.id : '';
  try {
    return toNozzleProfile(parseProfileInput({
      ...item,
      id,
      name: item.name,
      smoothing: item.smoothing ?? 4,
      borderWidth: item.borderWidth ?? 0,
      borderDepth: item.borderDepth ?? 0,
    }), id);
  } catch {
    return null;
  }
}
