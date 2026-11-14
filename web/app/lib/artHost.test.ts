import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFetchableArtUrl, isScryfallArtUrl } from './artHost';

test('only https Scryfall hosts are accepted as source art', () => {
  assert.equal(isScryfallArtUrl('https://cards.scryfall.io/art_crop/front/a/b/card.jpg'), true);
  assert.equal(isScryfallArtUrl('https://api.scryfall.com/cards/named?exact=Brigid'), true);
  assert.equal(isScryfallArtUrl('http://cards.scryfall.io/art.jpg'), false);
  assert.equal(isScryfallArtUrl('https://evil.example/cards.scryfall.io/art.jpg'), false);
  assert.equal(isScryfallArtUrl('https://user:pass@cards.scryfall.io/art.jpg'), false);
});

test('the same-origin proxy can read Scryfall and S3, and nothing else', () => {
  assert.equal(isFetchableArtUrl('https://cards.scryfall.io/art_crop/x.jpg'), true);
  assert.equal(isFetchableArtUrl('https://mtgstore-orders.s3.us-east-1.amazonaws.com/outpaint/v2/right/abc.png?X-Amz-Signature=1'), true);
  assert.equal(isFetchableArtUrl('https://mtgstore-orders.s3.amazonaws.com/outpaint/v2/left/abc.png'), true);
  assert.equal(isFetchableArtUrl('https://s3.us-east-1.amazonaws.com/mtgstore-orders/outpaint/v2/right/abc.png'), true);
  assert.equal(isFetchableArtUrl('https://cdn.example.com/art.png'), false);
  assert.equal(isFetchableArtUrl('https://169.254.169.254/latest/meta-data'), false);
});
