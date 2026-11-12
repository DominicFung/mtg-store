import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { searchCardByName, searchCardsByName, toCard } from './searchCardByName.ts';

const originalTable = process.env.CARD_TABLE_NAME;

afterEach(() => {
  if (originalTable === undefined) {
    delete process.env.CARD_TABLE_NAME;
  } else {
    process.env.CARD_TABLE_NAME = originalTable;
  }
});

describe('searchCardsByName', () => {
  const cards = [
    { id: '1', name: 'Sol Ring', isRamp: true },
    { id: '2', name: 'Lightning Bolt', isRamp: false },
    { id: '3', name: 'Soldevi Excavations', isRamp: false },
  ];

  it('ranks an exact name match first', () => {
    const result = searchCardsByName(cards, 'sol ring');
    assert.equal(result[0]?.name, 'Sol Ring');
    assert.equal(result[0]?.isRamp, true);
    assert.equal(result.some((card) => card.name === 'Lightning Bolt'), false);
  });

  it('returns nothing when no name is close', () => {
    assert.deepEqual(searchCardsByName(cards, 'black lotus'), []);
  });
});

describe('toCard', () => {
  it('reads the table key attributes', () => {
    assert.deepEqual(toCard({ cardId: 'lea-240', cardName: 'Sol Ring', isRamp: true }), {
      id: 'lea-240',
      name: 'Sol Ring',
      isRamp: true,
    });
  });

  it('skips rows with no name', () => {
    assert.equal(toCard({ cardId: 'x' }), undefined);
  });
});

describe('searchCardByName handler', () => {
  it('scans every page of CARD_TABLE_NAME and returns fuzzy matches', async () => {
    process.env.CARD_TABLE_NAME = 'mtgstore-CardTable';
    const tables: string[] = [];
    const pages = [
      {
        Items: [
          { cardId: '1', cardName: 'Lightning Bolt', isRamp: false },
          { id: '2', name: 'Soldevi Excavations', isRamp: false },
        ],
        LastEvaluatedKey: { cardId: '2' },
      },
      {
        Items: [{ cardId: '3', cardName: 'Sol Ring', isRamp: true }],
      },
    ];

    const result = await searchCardByName(
      { arguments: { name: 'sol ring' } } as Parameters<typeof searchCardByName>[0],
      {
        async send(command) {
          assert.ok(command instanceof ScanCommand);
          tables.push(command.input.TableName ?? '');
          const page = pages.shift();
          assert.ok(page);
          return page;
        },
      },
    );

    assert.deepEqual(tables, ['mtgstore-CardTable', 'mtgstore-CardTable']);
    assert.equal(result[0]?.name, 'Sol Ring');
    assert.equal(result[0]?.id, '3');
    assert.equal(result[0]?.isRamp, true);
  });

  it('fails when the table name is not configured', async () => {
    delete process.env.CARD_TABLE_NAME;
    await assert.rejects(
      () => searchCardByName(
        { arguments: { name: 'sol ring' } } as Parameters<typeof searchCardByName>[0],
        { async send() { throw new Error('scan should not run'); } },
      ),
      /CARD_TABLE_NAME is not set/,
    );
  });
});
