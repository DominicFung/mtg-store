import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmGeneration } from '../appsync/orders/confirmOrder';
import { enqueueIfNeeded } from '../payments/webhook';
import {
  canBackstopEnqueue,
  fulfillmentPreserved,
  generationDecision,
} from './logic';
import { unaliasedReservedWords, updateOrder } from './store';
import type { OrderItem } from './view';

test('a bare status condition is rejected before DynamoDB sees it', async () => {
  assert.deepEqual(unaliasedReservedWords('status = :received'), ['status']);
  assert.deepEqual(unaliasedReservedWords('#status = :received'), []);
  assert.deepEqual(unaliasedReservedWords('attribute_exists(orderId)'), []);
  assert.deepEqual(unaliasedReservedWords('attribute_not_exists(#gs) OR #gs <> :generating'), []);
  await assert.rejects(
    () => updateOrder('order-1', { updatedAt: 'now' }, 'status = :received', { ':received': 'RECEIVED' }),
    /reserved word status/,
  );
});

test('confirmOrder aliases status, enqueues once, and rethrows other errors', async () => {
  const order = {
    orderId: 'order-1',
    orderNumber: 'MR-TESTTEST',
    email: 'owner@example.com',
    name: 'Ada',
    status: 'RECEIVED',
    createdAt: '2026-11-19T00:00:00.000Z',
    updatedAt: '2026-11-19T00:00:00.000Z',
    generationAttempt: 0,
    history: [],
  } as OrderItem;
  const enqueued: number[] = [];
  let condition = '';
  const deps = {
    findByOrderNumber: async () => order,
    objectExists: async () => true,
    updateOrder: async (_id: string, _updates: Record<string, unknown>, nextCondition?: string) => {
      condition = nextCondition ?? '';
      if (unaliasedReservedWords(nextCondition ?? '').length) {
        const error = new Error('Invalid ConditionExpression');
        error.name = 'ValidationException';
        throw error;
      }
    },
    enqueueGeneration: async (_id: string, attempt: number) => {
      enqueued.push(attempt);
    },
  };
  await confirmGeneration(deps, 'MR-TESTTEST', 'owner@example.com');
  assert.match(condition, /#status/);
  assert.deepEqual(enqueued, [1]);

  const lost = new Error('lost');
  lost.name = 'ConditionalCheckFailedException';
  deps.updateOrder = async () => { throw lost; };
  enqueued.length = 0;
  const summary = await confirmGeneration(deps, 'MR-TESTTEST', 'owner@example.com');
  assert.equal(summary.orderId, 'order-1');
  assert.deepEqual(enqueued, []);

  const boom = new Error('throttle');
  boom.name = 'ProvisionedThroughputExceededException';
  deps.updateOrder = async () => { throw boom; };
  await assert.rejects(() => confirmGeneration(deps, 'MR-TESTTEST', 'owner@example.com'), /throttle/);
});

test('the paid webhook backstop does not enqueue twice', async () => {
  assert.equal(canBackstopEnqueue({ status: 'RECEIVED', generationAttempt: 0 }), true);
  assert.equal(canBackstopEnqueue({ status: 'RECEIVED', outputKey: 'orders/x/output/deck-box.zip' }), false);
  assert.equal(canBackstopEnqueue({ status: 'SHIPPED', generationStatus: 'GENERATING' }), false);
  assert.equal(canBackstopEnqueue({ status: 'DELIVERED' }), true);
  assert.equal(canBackstopEnqueue({ status: 'PRINTING', generationStatus: 'READY', outputKey: 'zip' }), false);

  let calls = 0;
  const updates: string[] = [];
  const enqueued: number[] = [];
  const deps = {
    updateOrder: async (_id: string, _updates: Record<string, unknown>, condition?: string) => {
      updates.push(condition ?? '');
      calls += 1;
      if (calls > 1) {
        const error = new Error('busy');
        error.name = 'ConditionalCheckFailedException';
        throw error;
      }
    },
    enqueueGeneration: async (_id: string, attempt: number) => {
      enqueued.push(attempt);
    },
  };
  const first = await enqueueIfNeeded({ orderId: 'order-1', status: 'RECEIVED', generationAttempt: 0 }, deps);
  const raced = await enqueueIfNeeded({ orderId: 'order-1', status: 'RECEIVED', generationAttempt: 0 }, deps);
  const second = await enqueueIfNeeded({ orderId: 'order-1', status: 'RECEIVED', generationStatus: 'GENERATING', generationAttempt: 1 }, deps);
  assert.equal(first, true);
  assert.equal(raced, false);
  assert.equal(second, false);
  assert.deepEqual(enqueued, [1]);
  assert.match(updates[0] ?? '', /#gs/);
  assert.equal(unaliasedReservedWords(updates[0] ?? '').length, 0);
});

test('regeneration runs for a shipped order and does not require a status change', () => {
  assert.equal(fulfillmentPreserved('SHIPPED'), true);
  assert.equal(fulfillmentPreserved('DELIVERED'), true);
  assert.equal(fulfillmentPreserved('PRINTING'), true);
  assert.equal(fulfillmentPreserved('RECEIVED'), false);
  assert.equal(generationDecision({
    status: 'SHIPPED',
    generationAttempt: 4,
    outputKey: 'orders/x/output/deck-box.zip',
    generationStatus: 'GENERATING',
  }, { attempt: 4 }), 'run');
  assert.equal(generationDecision({
    status: 'DELIVERED',
    generationAttempt: 2,
    outputKey: 'orders/x/output/deck-box.zip',
    generationStatus: 'READY',
  }, { attempt: 2 }), 'skip');
  assert.equal(generationDecision({
    status: 'PRINTING',
    generationAttempt: 1,
    generationStatus: 'FAILED',
  }, { attempt: 1 }), 'run');
});
