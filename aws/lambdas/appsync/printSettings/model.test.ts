import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPrintSettings, DEFAULT_PRINT_SETTINGS, fromItem } from './model.ts';

test('a row written before the colour-core fields still loads, with the new defaults', () => {
  const loaded = fromItem({
    layerHeight: 0.08,
    baseLayerHeight: 0.16,
    width: 82.44,
    height: 105.45,
    nozzleSize: 0.4,
  });
  assert.equal(loaded.layerHeight, 0.08);
  assert.equal(loaded.baseLayerHeight, 0.16);
  assert.equal(loaded.nozzleSize, 0.4);
  assert.equal(loaded.minDepth, DEFAULT_PRINT_SETTINGS.minDepth);
  assert.equal(loaded.maxDepth, DEFAULT_PRINT_SETTINGS.maxDepth);
  assert.equal(loaded.borderWidth, 0);
  assert.equal(loaded.borderDepth, 0);
  assert.equal(loaded.detailSize, 0.1);
});

test('an update may omit the new fields and still keeps them', () => {
  const saved = assertPrintSettings({
    layerHeight: 0.04,
    baseLayerHeight: 0.09,
    width: 90,
    height: 105.45,
    nozzleSize: 0.2,
  });
  assert.equal(saved.width, 90);
  assert.equal(saved.minDepth, 0.25);
  assert.equal(saved.detailSize, 0.1);
});

test('present colour-core fields are stored, and a bad depth is rejected', () => {
  const saved = assertPrintSettings({
    ...DEFAULT_PRINT_SETTINGS,
    minDepth: 0.4,
    maxDepth: 2.5,
    borderWidth: 5,
  });
  assert.equal(saved.minDepth, 0.4);
  assert.equal(saved.maxDepth, 2.5);
  assert.equal(saved.borderWidth, 5);
  assert.throws(() => assertPrintSettings({
    ...DEFAULT_PRINT_SETTINGS,
    minDepth: 3,
    maxDepth: 2,
  }));
});
