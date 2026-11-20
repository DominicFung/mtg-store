import type { ShopOrder } from './shopOrders';

export const PRINT_FILE_POLL_MS = 3000;
export const PRINT_FILE_POLL_TIMEOUT_MS = 2 * 60 * 1000;

export type PrintFilePollOutcome = 'ready' | 'failed' | 'timeout' | 'stopped';

/** GENERATING wins over leftover zip keys, so a regeneration is not treated as already done. */
export function printFilePollStep(order: Pick<ShopOrder, 'generationStatus' | 'generationError' | 'generatedFiles' | 'outputKey'> | null): 'continue' | 'ready' | 'failed' {
  if (!order) return 'continue';
  if (order.generationStatus === 'GENERATING') return 'continue';
  if (order.generationStatus === 'FAILED') return 'failed';
  const files = order.generatedFiles?.length ?? 0;
  if (order.generationStatus === 'READY' && files > 0) return 'ready';
  if (order.generationStatus === 'READY') return 'continue';
  if (files > 0 || order.outputKey) return 'ready';
  if (order.generationError) return 'failed';
  return 'continue';
}

export async function pollPrintFiles(options: {
  load: () => Promise<ShopOrder | null>;
  intervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  shouldStop?: () => boolean;
}): Promise<{ outcome: PrintFilePollOutcome; order: ShopOrder | null }> {
  const intervalMs = options.intervalMs ?? PRINT_FILE_POLL_MS;
  const timeoutMs = options.timeoutMs ?? PRINT_FILE_POLL_TIMEOUT_MS;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => { setTimeout(resolve, ms); }));
  const now = options.now ?? (() => Date.now());
  const shouldStop = options.shouldStop ?? (() => false);
  const started = now();
  let latest: ShopOrder | null = null;
  while (!shouldStop()) {
    if (now() - started >= timeoutMs) return { outcome: 'timeout', order: latest };
    try {
      latest = await options.load();
    } catch {
      latest = latest ?? null;
    }
    if (shouldStop()) return { outcome: 'stopped', order: latest };
    const step = printFilePollStep(latest);
    if (step === 'ready') return { outcome: 'ready', order: latest };
    if (step === 'failed') return { outcome: 'failed', order: latest };
    if (now() - started >= timeoutMs) return { outcome: 'timeout', order: latest };
    await sleep(intervalMs);
  }
  return { outcome: 'stopped', order: latest };
}
