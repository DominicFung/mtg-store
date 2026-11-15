import assert from 'node:assert/strict';
import { test } from 'node:test';
import { everyHomePhoto } from './deckBoxPhotos';

test('the home page uses each printed-box photo once', () => {
  const srcs = everyHomePhoto.map((photo) => photo.src);
  assert.equal(srcs.length, 17);
  assert.equal(new Set(srcs).size, srcs.length);
  for (const photo of everyHomePhoto) {
    assert.equal(/hueforge/i.test(photo.alt), false);
    assert.equal(/hueforge/i.test(photo.src), false);
    assert.ok(photo.width > 0 && photo.height > 0);
  }
});
