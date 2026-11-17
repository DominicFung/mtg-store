import { buildReliefSurface, type PrintSettings, type ReliefSurface } from './printGeometry';
import type { CoreStop } from './colourCore';

type Request = {
  index: number;
  rgba: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  settings: PrintSettings;
  stops: CoreStop[];
  maxTriangles?: number;
};

type Scope = {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

const scope = globalThis as unknown as Scope;

scope.onmessage = (event) => {
  const surface: ReliefSurface = buildReliefSurface(event.data);
  const { positions, uvs, index } = surface;
  scope.postMessage({
    index: event.data.index,
    surface: {
      widthMm: surface.widthMm,
      heightMm: surface.heightMm,
      cols: surface.cols,
      rows: surface.rows,
      actualDepthMm: surface.actualDepthMm,
      positions,
      uvs,
      index,
    },
  }, [positions.buffer, uvs.buffer, index.buffer]);
};
