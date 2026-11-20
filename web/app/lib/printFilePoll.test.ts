import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pollPrintFiles, printFilePollStep, type PrintFilePollOutcome } from './printFilePoll';
import type { ShopOrder } from './shopOrders';

function order(patch: Partial<ShopOrder>): ShopOrder {
  return {
    orderId: 'order-1',
    orderNumber: 'MR-TESTTEST',
    email: 'owner@example.com',
    name: 'Ada',
    status: 'GENERATING_FILES',
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
    priceLabel: 'CA$55',
    paymentStatus: 'PAID',
    profileName: '0.2 mm',
    nozzleSize: 0.2,
    layerCount: 50,
    stops: [],
    previews: [],
    history: [],
    ...patch,
  };
}

test('a generating order keeps polling until the zip is listed', async () => {
  const generating = order({ generationStatus: 'GENERATING', generatedFiles: [] });
  const ready = order({
    generationStatus: 'READY',
    status: 'READY_TO_PRINT',
    generatedFiles: ['orders/order-1/output/deck-box.zip', 'orders/order-1/output/deck-box-faces.zip'],
  });
  const seen: string[] = [];
  let clock = 0;
  const result = await pollPrintFiles({
    load: async () => {
      seen.push(clock < 3000 ? 'generating' : 'ready');
      return clock < 3000 ? generating : ready;
    },
    intervalMs: 3000,
    timeoutMs: 20000,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
  });
  assert.equal(result.outcome, 'ready');
  assert.equal(result.order?.generationStatus, 'READY');
  assert.deepEqual(seen, ['generating', 'ready']);
});

test('polling stops on failure, timeout, and unmount', async () => {
  const failed = order({ generationStatus: 'FAILED', generationError: 'out of memory' });
  const failure = await pollPrintFiles({
    load: async () => failed,
    intervalMs: 1000,
    timeoutMs: 5000,
    now: () => 0,
    sleep: async () => undefined,
  });
  assert.equal(failure.outcome, 'failed');

  let clock = 0;
  const loads: number[] = [];
  const timeout = await pollPrintFiles({
    load: async () => {
      loads.push(clock);
      return order({ generationStatus: 'GENERATING' });
    },
    intervalMs: 1000,
    timeoutMs: 2500,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
  });
  assert.equal(timeout.outcome, 'timeout');
  assert.ok(loads.length >= 2);
  assert.ok(loads.length < 6);

  let stopped = false;
  let calls = 0;
  const unmounted = await pollPrintFiles({
    load: async () => {
      calls += 1;
      stopped = true;
      return order({ generationStatus: 'GENERATING' });
    },
    intervalMs: 1000,
    timeoutMs: 20000,
    now: () => 0,
    sleep: async () => undefined,
    shouldStop: () => stopped && calls > 0,
  });
  assert.equal(unmounted.outcome satisfies PrintFilePollOutcome, 'stopped');
  assert.equal(calls, 1);
});

test('leftover zip keys do not end a regeneration early', () => {
  assert.equal(printFilePollStep(order({
    generationStatus: 'GENERATING',
    generatedFiles: ['orders/order-1/output/deck-box.zip'],
    outputKey: 'orders/order-1/output/deck-box.zip',
  })), 'continue');
  assert.equal(printFilePollStep(order({
    generationStatus: 'READY',
    generatedFiles: ['orders/order-1/output/deck-box.zip'],
  })), 'ready');
});
