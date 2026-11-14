import { buildFaceMesh, type FaceMesh, type PrintSettings } from './printGeometry';
import type { CoreStop } from './hueforge';

type Request = {
  id: number;
  rgba: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  cropWidthPx?: number;
  cropHeightPx?: number;
  settings: PrintSettings;
  stops: CoreStop[];
  header: string;
  smoothing?: number;
};

type Scope = {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};

const scope = globalThis as unknown as Scope;

scope.onmessage = (event) => {
  const mesh = buildFaceMesh(event.data);
  const stl = mesh.stl;
  const summary: Omit<FaceMesh, 'stl'> = {
    widthMm: mesh.widthMm,
    heightMm: mesh.heightMm,
    cols: mesh.cols,
    rows: mesh.rows,
    stepMm: mesh.stepMm,
    triangles: mesh.triangles,
    actualDepthMm: mesh.actualDepthMm,
    layerCount: mesh.layerCount,
  };
  scope.postMessage({ id: event.data.id, summary, stl }, [stl.buffer]);
};
