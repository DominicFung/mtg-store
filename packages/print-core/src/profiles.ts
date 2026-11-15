import { colorCoreLayerCount, layerForDepth, layerTopMm, type LayerSettings } from './hueforge';
import type { PrintSettings } from './printGeometry';

/**
 * A nozzle profile is the print settings for one nozzle, stored so the shop
 * can change them without a deploy. `layerCount` is derived. `layersAtMaxDepth`
 * is the 1-based layer whose top meets Max Depth (the top slider on a
 * HueForge colour core that stops on Max Depth). The mesh white point is one
 * layer higher, which is `layerCount`.
 */
export type NozzleProfile = LayerSettings & {
  id: string;
  name: string;
  nozzleSize: number;
  detailSize: number;
  borderWidth: number;
  borderDepth: number;
  /** HueForge smoothing slider. 4 is one 3×3 on a 0.10 mm grid and no extra blur on a 0.20 mm grid. */
  smoothing: number;
  /** Aspect-fit clamp. The 0.2 mm plates are wider than the nominal spine. */
  maxWidth: number;
  /** Shared face height, in millimetres. */
  maxHeight: number;
  /** Nominal back-face width kept on the legacy print-settings row. */
  nominalWidth: number;
  active: boolean;
  isDefault: boolean;
};

export type ResolvedProfile = NozzleProfile & {
  layerCount: number;
  layersAtMaxDepth: number;
  /** Mesh white point before brightness adjust, in millimetres. */
  coreTopMm: number;
};

export const LAUNCH_PROFILE_ID = 'nozzle-0.2';
export const NOZZLE_04_PROFILE_ID = 'nozzle-0.4';

export const LAUNCH_PROFILES: readonly NozzleProfile[] = [
  {
    id: LAUNCH_PROFILE_ID,
    name: '0.2 mm',
    nozzleSize: 0.2,
    layerHeight: 0.04,
    baseLayerHeight: 0.09,
    detailSize: 0.1,
    minDepth: 0.25,
    maxDepth: 2.01,
    borderWidth: 0,
    borderDepth: 0,
    smoothing: 4,
    brightnessAdjust: 0,
    maxWidth: 120,
    maxHeight: 105.45,
    nominalWidth: 82.44,
    active: true,
    isDefault: true,
  },
  {
    id: NOZZLE_04_PROFILE_ID,
    name: '0.4 mm',
    nozzleSize: 0.4,
    layerHeight: 0.08,
    baseLayerHeight: 0.16,
    detailSize: 0.2,
    minDepth: 0.24,
    maxDepth: 2,
    borderWidth: 0,
    borderDepth: 0,
    smoothing: 4,
    brightnessAdjust: -0.14,
    maxWidth: 120,
    maxHeight: 105.45,
    nominalWidth: 82.44,
    active: true,
    isDefault: false,
  },
];

export function resolveProfile(profile: NozzleProfile): ResolvedProfile {
  const settings: LayerSettings = profile;
  const layerCount = colorCoreLayerCount(settings);
  return {
    ...profile,
    layerCount,
    layersAtMaxDepth: layerForDepth(profile.maxDepth, settings),
    coreTopMm: layerTopMm(layerCount, settings),
  };
}

export function defaultProfile(): ResolvedProfile {
  const found = LAUNCH_PROFILES.find((profile) => profile.isDefault) ?? LAUNCH_PROFILES[0];
  return resolveProfile(found);
}

/** Settings the mesh and the colour-core preview both consume. */
export function profileToSettings(profile: NozzleProfile): PrintSettings {
  return {
    layerHeight: profile.layerHeight,
    baseLayerHeight: profile.baseLayerHeight,
    width: profile.nominalWidth,
    height: profile.maxHeight,
    nozzleSize: profile.nozzleSize,
    minDepth: profile.minDepth,
    maxDepth: profile.maxDepth,
    borderWidth: profile.borderWidth,
    borderDepth: profile.borderDepth,
    detailSize: profile.detailSize,
    smoothing: profile.smoothing,
    brightnessAdjust: profile.brightnessAdjust ?? 0,
    maxWidth: profile.maxWidth,
  };
}
