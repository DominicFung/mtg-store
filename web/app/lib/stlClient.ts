import type { CoreStop } from './colourCore';
import { buildFaceMesh, type FaceMesh, type PrintSettings } from './printGeometry';

type MeshRequest = {
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

type WorkerReply = {
  id: number;
  summary: Omit<FaceMesh, 'stl'>;
  stl: Uint8Array;
};

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (mesh: FaceMesh) => void; reject: (error: Error) => void }>();

function attach(instance: Worker) {
  instance.onmessage = (event: MessageEvent<WorkerReply>) => {
    const waiting = pending.get(event.data.id);
    if (!waiting) return;
    pending.delete(event.data.id);
    waiting.resolve({ ...event.data.summary, stl: event.data.stl });
  };
  instance.onerror = () => {
    worker = null;
    pending.forEach((waiting) => waiting.reject(new Error('Mesh worker failed')));
    pending.clear();
  };
}

function meshOnThisThread(input: MeshRequest): FaceMesh {
  return buildFaceMesh(input);
}

/** Encode the colour-core STL off the UI thread. Falls back to this thread if workers are unavailable. */
export function buildFaceMeshAsync(input: MeshRequest): Promise<FaceMesh> {
  if (typeof Worker === 'undefined') return Promise.resolve(meshOnThisThread(input));
  try {
    if (!worker) {
      worker = new Worker(new URL('./stl.worker.ts', import.meta.url));
      attach(worker);
    }
    const id = nextId;
    nextId += 1;
    const rgba = input.rgba.slice();
    return new Promise<FaceMesh>((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker?.postMessage({ ...input, id, rgba }, [rgba.buffer]);
    }).catch(() => meshOnThisThread(input));
  } catch {
    return Promise.resolve(meshOnThisThread(input));
  }
}
