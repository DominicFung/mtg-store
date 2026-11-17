import type { CoreStop } from './colourCore';
import { buildReliefSurface, type PrintSettings, type ReliefSurface } from './printGeometry';

export type ReliefBuffers = Pick<ReliefSurface, 'widthMm' | 'heightMm' | 'cols' | 'rows' | 'actualDepthMm' | 'positions' | 'uvs' | 'index'>;

type ReliefRequest = {
  rgba: Uint8Array;
  imageWidth: number;
  imageHeight: number;
  settings: PrintSettings;
  stops: CoreStop[];
  maxTriangles?: number;
};

type WorkerReply = {
  index: number;
  surface: ReliefBuffers;
};

let worker: Worker | null = null;
let batch = 0;

function buildHere(faces: ReliefRequest[]): ReliefBuffers[] {
  return faces.map((face) => buildReliefSurface(face));
}

/** Rebuild every face off the UI thread. A newer call cancels the one still running. */
export function buildReliefBatch(faces: ReliefRequest[]): Promise<ReliefBuffers[]> {
  if (faces.length === 0) return Promise.resolve([]);
  if (typeof Worker === 'undefined') return Promise.resolve(buildHere(faces));
  const id = batch + 1;
  batch = id;
  try {
    worker?.terminate();
    worker = new Worker(new URL('./relief.worker.ts', import.meta.url));
  } catch {
    return Promise.resolve(buildHere(faces));
  }
  const results: ReliefBuffers[] = new Array(faces.length);
  let finished = 0;
  return new Promise<ReliefBuffers[]>((resolve, reject) => {
    const instance = worker;
    if (!instance) {
      resolve(buildHere(faces));
      return;
    }
    instance.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (id !== batch) return;
      results[event.data.index] = event.data.surface;
      finished += 1;
      if (finished === faces.length) resolve(results);
    };
    instance.onerror = () => {
      if (id !== batch) return;
      worker?.terminate();
      worker = null;
      try {
        resolve(buildHere(faces));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Relief mesh failed'));
      }
    };
    faces.forEach((face, index) => {
      const rgba = face.rgba.slice();
      instance.postMessage({ ...face, index, rgba }, [rgba.buffer]);
    });
  });
}
