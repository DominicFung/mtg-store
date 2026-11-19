import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveTimeline, formatToronto } from './statusTimeline';

test('undo rows drop out and each stage keeps its latest time', () => {
  const timeline = effectiveTimeline({
    status: 'PRINTING',
    paymentStatus: 'PAID',
    createdAt: '2026-11-19T15:00:00.000Z',
    history: [
      { status: 'RECEIVED', at: '2026-11-19T15:00:00.000Z', note: 'Order placed' },
      { status: 'PRINTING', at: '2026-11-19T16:00:00.000Z', note: 'Status advanced' },
      { status: 'READY_TO_PRINT', at: '2026-11-19T16:10:00.000Z', note: 'Status undone' },
      { status: 'PRINTING', at: '2026-11-19T16:22:00.000Z', note: 'Status advanced' },
      { status: 'SHIPPED', at: '2026-11-19T18:00:00.000Z', note: 'Status advanced' },
    ],
  });
  assert.equal(timeline.current, 1);
  assert.equal(timeline.stages[0]?.label, 'Order placed / Paid');
  assert.equal(timeline.stages[1]?.at, '2026-11-19T16:22:00.000Z');
  assert.equal(timeline.stages[2]?.at, undefined);
  assert.equal(timeline.stages[3]?.at, undefined);
  assert.equal(timeline.stages[4]?.label, 'Delivered');
});

test('Toronto time is used for a stage timestamp', () => {
  const label = formatToronto('2026-11-19T21:22:00.000Z');
  assert.match(label, /Nov 19/);
  assert.match(label, /4:22/);
});
