import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LAUNCH_PROFILES } from '../../../packages/print-core/src/profiles';
import { parseProfileInput, profileView, publicProfiles, SEEDED_PROFILES, toNozzleProfile } from './logic';

test('the seeded 0.2 mm profile is the default 50-layer launch profile', () => {
  const views = publicProfiles(SEEDED_PROFILES);
  assert.equal(views.length, 2);
  assert.equal(views[0].id, 'nozzle-0.2');
  assert.equal(views[0].layerCount, 50);
  assert.equal(views[0].isDefault, true);
  assert.equal(views[1].layersAtMaxDepth, 24);
  assert.equal(views[1].layerCount, 25);
  assert.equal(views[1].brightnessAdjust, -0.14);
  const seed = JSON.parse(readFileSync(new URL('../../seeds/nozzleProfiles.json', import.meta.url), 'utf8')) as Array<Record<string, unknown>>;
  assert.equal(seed.length, LAUNCH_PROFILES.length);
  assert.equal(seed[0].layerHeight, LAUNCH_PROFILES[0].layerHeight);
  assert.equal(seed[1].detailSize, 0.2);
  assert.equal(seed[1].brightnessAdjust, -0.14);
  assert.equal(seed[0].borderWidth, 0);
  assert.equal(seed[1].borderDepth, 0);
  assert.equal(seed[0].smoothing, 4);
  assert.equal(views[0].borderWidth, 0);
});

test('profile edits stay inside the safe ranges and the default cannot be deactivated', () => {
  const saved = toNozzleProfile(parseProfileInput({
    ...LAUNCH_PROFILES[1],
    name: '0.4 mm draft',
    active: false,
    isDefault: false,
  }), 'nozzle-0.4');
  assert.equal(profileView(saved).active, false);
  assert.throws(() => parseProfileInput({ ...LAUNCH_PROFILES[0], brightnessAdjust: -2 }), /brightnessAdjust/);
  assert.throws(() => parseProfileInput({ ...LAUNCH_PROFILES[0], active: false, isDefault: true }), /default profile stays active/);
});
