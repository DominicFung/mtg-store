import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { findShopVideoIn } from './shopVideoFile';

function tempDir() {
  return mkdtempSync(path.join(tmpdir(), 'shop-video-'));
}

test('a missing videos directory leaves the player unused', () => {
  assert.equal(findShopVideoIn(path.join(tmpdir(), 'shop-video-missing', 'nope')), null);
});

test('a video without a poster stays hidden', () => {
  const dir = tempDir();
  try {
    writeFileSync(path.join(dir, 'box.mp4'), '');
    assert.equal(findShopVideoIn(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a video and a matching poster are returned for the silent player', () => {
  const dir = tempDir();
  try {
    writeFileSync(path.join(dir, 'table.webm'), '');
    writeFileSync(path.join(dir, 'table.webp'), '');
    assert.deepEqual(findShopVideoIn(dir), {
      src: '/videos/table.webm',
      poster: '/videos/table.webp',
      type: 'video/webm',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
