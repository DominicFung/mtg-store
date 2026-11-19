import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LAUNCH_PROFILES } from '../../../packages/print-core/src/profiles';
import { isAdmin } from './auth';
import {
  assertShipped,
  assertTransition,
  canRetry,
  generationDecision,
  newestOrders,
  nextFulfillment,
  previousFulfillment,
  newOrderNumber,
  parseSubmitInput,
  rateLimitMessage,
  readyEmail,
  snapshotLid,
  snapshotStops,
} from './logic';

const valid = {
  clientRequestId: '11111111-2222-4333-8444-555555555555',
  email: 'Fan@Example.com',
  name: 'Ada',
  profileId: 'nozzle-0.2',
  addressLine1: '1 Plains',
  city: 'Dominaria',
  country: 'CA',
  stops: [{ filamentId: 'blue', endLayer: 10 }, { filamentId: 'white', endLayer: 50 }],
  crops: [slot(), slot(), slot()],
  previews: [slot(), slot(), slot()],
};

function slot() {
  return { width: 400, height: 500, byteLength: 20_000 };
}

test('order numbers are unguessable and the parser lowercases email', () => {
  const first = newOrderNumber((size) => new Uint8Array(size).fill(0));
  const second = newOrderNumber((size) => new Uint8Array(size).fill(255));
  assert.equal(first, 'MR-AAAAAAAA');
  assert.notEqual(first, second);
  assert.match(second, /^MR-[A-Z2-9]{8}$/);
  const parsed = parseSubmitInput(valid);
  assert.equal(parsed.email, 'fan@example.com');
});

test('payload limits reject oversized images and out-of-order stops', () => {
  assert.throws(() => parseSubmitInput({ ...valid, crops: [slot(), slot(), { ...slot(), byteLength: 20_000_000 }] }), /12 MB/);
  assert.throws(() => parseSubmitInput({
    ...valid,
    stops: [{ filamentId: 'blue', endLayer: 40 }, { filamentId: 'white', endLayer: 10 }],
  }), /move up/);
  assert.equal(rateLimitMessage({ lastHour: 5, lastDay: 5 }), 'Too many orders from this email in the last hour. Try again later.');
  assert.equal(rateLimitMessage({ lastHour: 1, lastDay: 1 }), null);
});

test('filament snapshots come from the catalogue, not the client', () => {
  const stops = snapshotStops(parseSubmitInput(valid).stops, [
    { id: 'blue', name: 'BambuLab Basic Blue', hex: '#0000FF', td: 4, brand: 'BambuLab', type: 'PLA' },
    { id: 'white', name: 'Jade White', hex: '#FFFFFF', td: 5, brand: 'BambuLab', type: 'PLA' },
  ], LAUNCH_PROFILES[0]);
  assert.equal(stops[0].td, 4);
  assert.equal(stops[1].endLayer, 50);
  assert.throws(() => snapshotStops([{ filamentId: 'nope', endLayer: 10 }], [], LAUNCH_PROFILES[0]), /Unknown filament/);
});

test('lid colours are optional, catalogue-backed, and limited to 20 characters', () => {
  const plain = parseSubmitInput(valid);
  assert.equal(plain.lid, undefined);
  const withLid = parseSubmitInput({
    ...valid,
    artSource: 'upload',
    lid: { boxFilamentId: 'elegoo-pla-black', logoFilamentId: 'elegoo-pla-red', text: '  Dom Fungus  ', textFilamentId: 'deeplee-matte-white' },
  });
  assert.equal(withLid.lid?.text, 'Dom Fungus');
  const catalogue = [
    { id: 'elegoo-pla-black', name: 'Elegoo PLA Black', hex: '#161616', td: 0.5 },
    { id: 'elegoo-matte-pla-sakura-pink', name: 'Elegoo Matte PLA Sakura Pink', hex: '#F2A8C0', td: 4.8 },
    { id: 'elegoo-pla-red', name: 'Elegoo PLA Red', hex: '#D4252B', td: 3 },
    { id: 'deeplee-matte-white', name: 'Deeplee Matte White', hex: '#F4F1EA', td: 5 },
    { id: 'elegoo-pla-beige', name: 'Elegoo PLA Beige', hex: '#E6D5B8', td: 4.4 },
  ];
  const lid = snapshotLid(withLid.lid!, catalogue);
  assert.equal(lid.boxFilamentName, 'Elegoo PLA Black');
  assert.equal(lid.text, 'Dom Fungus');
  assert.equal(lid.textHex, '#F4F1EA');
  assert.equal(lid.logoFilamentName, 'Elegoo PLA Red');
  assert.throws(() => parseSubmitInput({ ...valid, lid: { boxFilamentId: 'elegoo-pla-black', logoFilamentId: 'elegoo-pla-red', text: 'this name is too long now', textFilamentId: 'deeplee-matte-white' } }), /20/);
  assert.throws(() => parseSubmitInput({ ...valid, artSource: 'example', lid: { boxFilamentId: 'elegoo-pla-black', logoFilamentId: 'elegoo-pla-red', textFilamentId: 'deeplee-matte-white' } }), /Sakura Pink/);
  assert.throws(() => parseSubmitInput({ ...valid, artSource: 'scryfall', lid: { boxFilamentId: 'elegoo-matte-pla-sakura-pink', logoFilamentId: 'deeplee-matte-white', textFilamentId: 'deeplee-matte-white' } }), /black/);
  assert.throws(() => parseSubmitInput({ ...valid, lid: { boxFilamentId: 'elegoo-pla-black', logoFilamentId: 'elegoo-pla-red', textFilamentId: 'elegoo-pla-red' } }), /white, beige/);
  assert.throws(() => snapshotLid({ boxFilamentId: 'missing', logoFilamentId: 'elegoo-pla-red', textFilamentId: 'deeplee-matte-white' }, catalogue), /not available/);
  const mail = readyEmail({
    orderNumber: 'MR-AAAAAAAA',
    name: 'Ada',
    downloadUrl: 'https://example.test/file',
    expiresHours: 4,
    lid,
  });
  assert.match(mail.text, /Elegoo PLA Black/);
  assert.match(mail.text, /lid-spark\.stl/);
  assert.match(mail.text, /Dom Fungus/);
});

test('status moves, shipping, retries, and stale generator messages', () => {
  assert.throws(() => assertTransition('RECEIVED', 'SHIPPED'), /Cannot move/);
  const shipped = assertShipped('READY_TO_SHIP', 'Canada Post', 'AB123456789CA');
  assert.equal(shipped.carrier, 'Canada Post');
  assert.equal(canRetry('FAILED'), true);
  assert.equal(canRetry('SHIPPED'), false);
  assert.equal(generationDecision({ status: 'GENERATING_FILES', generationAttempt: 2 }, { attempt: 2 }), 'run');
  assert.equal(generationDecision({ status: 'READY_TO_PRINT', generationAttempt: 2, outputKey: 'orders/x/output/deck-box.zip' }, { attempt: 2 }), 'skip');
  assert.equal(generationDecision({ status: 'GENERATING_FILES', generationAttempt: 3 }, { attempt: 2 }), 'skip');
  assert.equal(nextFulfillment('READY_TO_PRINT'), 'PRINTING');
  assert.equal(nextFulfillment('PRINTING'), 'READY_TO_SHIP');
  assert.equal(nextFulfillment('SHIPPED'), 'DELIVERED');
  assert.equal(previousFulfillment('DELIVERED'), 'SHIPPED');
  assert.equal(previousFulfillment('RECEIVED'), null);
  const merged = newestOrders([
    [{ orderId: 'old', createdAt: '2026-11-17T00:00:00.000Z' }, { orderId: 'lock#x', createdAt: '2026-11-19T00:00:00.000Z' }],
    [{ orderId: 'new', createdAt: '2026-11-19T00:00:00.000Z' }, { orderId: 'old', createdAt: '2026-11-17T00:00:00.000Z' }],
  ], 2);
  assert.deepEqual(merged.map((row) => row.orderId), ['new', 'old']);
  const mail = readyEmail({ orderNumber: 'MR-AAAAAAAA', name: 'Ada', downloadUrl: 'https://example.test/file', expiresHours: 4 });
  assert.match(mail.subject, /MR-AAAAAAAA/);
  assert.match(mail.text, /admin page/);
});

test('only the admin group passes the admin check', () => {
  assert.equal(isAdmin({ claims: { 'cognito:groups': ['admin'] } }), true);
  assert.equal(isAdmin({ claims: { 'cognito:groups': 'admin' } }), true);
  assert.equal(isAdmin({ claims: { 'cognito:groups': ['customers'] } }), false);
  assert.equal(isAdmin(null), false);
});
