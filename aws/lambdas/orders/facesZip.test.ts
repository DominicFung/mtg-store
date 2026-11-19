import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { facesZipBytes } from './facesZip';

test('the face zip keeps only the three plates from a stored print zip', async () => {
  const source = new JSZip();
  source.file('left.stl', Buffer.from('left-plate'));
  source.file('spine.stl', Buffer.from('spine-plate'));
  source.file('right.stl', Buffer.from('right-plate'));
  source.file('lid-colours.txt', 'not included');
  source.file('filament-layers.json', '{}');
  const full = await source.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
  const faces = await facesZipBytes(async (start, end) => full.subarray(start, end + 1), full.length);
  const zip = await JSZip.loadAsync(faces);
  assert.deepEqual(Object.keys(zip.files).sort(), ['left.stl', 'right.stl', 'spine.stl']);
  assert.equal(await zip.file('left.stl')?.async('string'), 'left-plate');
  assert.equal(await zip.file('spine.stl')?.async('string'), 'spine-plate');
  assert.equal(await zip.file('right.stl')?.async('string'), 'right-plate');
});
