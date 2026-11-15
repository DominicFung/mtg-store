export {
  buildFaceMesh,
  buildVertexHeights,
  clampToMaxWidth,
  decodeBinaryStl,
  DEFAULT_PRINT_SETTINGS,
  encodeBinaryStl,
  encodeHeightfieldStl,
  canonicalFaceName,
  FACE_NAMES,
  faceNormal,
  heightRange,
  MAX_MESH_TRIANGLES,
  meshGrid,
  meshTriangleCount,
  modelSizeForCrop,
  PRINT_SETTINGS_ID,
  roundMm,
  triangleBounds,
  triangleBoundsFromStl,
  umToMm,
} from '../../../packages/print-core/src/printGeometry';

export type {
  FaceMesh,
  FaceName,
  HeightField,
  PrintSettings,
  Triangle,
  Vec3,
} from '../../../packages/print-core/src/printGeometry';

export {
  defaultProfile,
  LAUNCH_PROFILE_ID,
  LAUNCH_PROFILES,
  NOZZLE_04_PROFILE_ID,
  profileToSettings,
  resolveProfile,
} from '../../../packages/print-core/src/profiles';

export type { NozzleProfile, ResolvedProfile } from '../../../packages/print-core/src/profiles';
