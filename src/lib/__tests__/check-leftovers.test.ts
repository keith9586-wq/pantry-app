/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkedToday, confidence, pickChecks } from '../confidence';
import { leftoverName, leftoversFirst, makeLeftover } from '../leftovers';
import { cookRecipe } from '../recipes';
import { rowToItem, itemToRow } from '../../sync/rows';
import type { InventoryItem } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-10T12:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * DAY).toISOString();
const ahead = (d: number) => new Date(NOW.getTime() + d * DAY).toISOString();

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: over.name ?? 'x',
  name: 'Milk',
  key: 'milk',
  category: 'dairy',
  storage: 'fridge',
  quantity: 1,
  unit: 'gal',
  fill: 'full',
  addedAt: ago(0),
  expiresAt: ahead(7),
  expirySource: 'predicted',
  ...over,
});

test('confidence falls with age and low fill, and is lowest once past its date', () => {
  const fresh = confidence(item({ addedAt: ago(0), expiresAt: ahead(7) }), NOW);
  const older = confidence(item({ addedAt: ago(5), expiresAt: ahead(2) }), NOW);
  const low = confidence(item({ addedAt: ago(5), expiresAt: ahead(2), fill: 'low' }), NOW);
  const expired = confidence(item({ addedAt: ago(9), expiresAt: ago(2) }), NOW);
  assert.equal(fresh, 1);
  assert.ok(older < fresh && low < older, `${fresh} ${older} ${low}`);
  assert.ok(expired <= 0.1);
});

test('a check resets confidence', () => {
  const stale = item({ addedAt: ago(6), expiresAt: ahead(1) });
  assert.ok(confidence({ ...stale, checkedAt: ago(0) }, NOW) > confidence(stale, NOW));
});

test('long-life food is still asked about eventually', () => {
  const rice = item({ name: 'Rice', key: 'rice', category: 'grains', storage: 'pantry', addedAt: ago(25), expiresAt: ahead(340) });
  assert.ok(confidence(rice, NOW) < 0.7);
});

test('the daily check picks the least sure items, skips fresh and just-checked ones', () => {
  const items = [
    item({ name: 'Fresh milk', addedAt: ago(0) }),
    item({ name: 'Old yogurt', addedAt: ago(10), expiresAt: ago(1) }),
    item({ name: 'Spinach', addedAt: ago(4), expiresAt: ahead(1), fill: 'half' }),
    item({ name: 'Checked cheese', addedAt: ago(20), expiresAt: ahead(2), checkedAt: ago(1) }),
  ];
  assert.deepEqual(pickChecks(items, NOW).map((i) => i.name), ['Old yogurt', 'Spinach']);
  assert.equal(pickChecks(items, NOW, 1).length, 1);
});

test('checkedToday compares calendar days', () => {
  assert.equal(checkedToday(null, NOW), false);
  assert.equal(checkedToday(NOW.toISOString(), NOW), true);
  assert.equal(checkedToday(ago(1), NOW), false);
});

test('leftovers are portions in the fridge, eaten within 4 days', () => {
  const tuesday = new Date(2026, 10, 10, 19);
  const l = makeLeftover('Chili', 3, tuesday, 'abc');
  assert.equal(l.name, 'Chili (Tuesday)');
  assert.equal(leftoverName(' Soup ', new Date(2026, 10, 8)), 'Soup (Sunday)');
  assert.equal(l.quantity, 3);
  assert.equal(l.unit, 'portion');
  assert.equal(l.storage, 'fridge');
  assert.equal(new Date(l.expiresAt!).getTime() - tuesday.getTime(), 4 * DAY);
  assert.equal(l.leftover, true);
});

test('leftovers sort oldest first and are never used as an ingredient', () => {
  const a = makeLeftover('Chili', 2, new Date(2026, 10, 9), 'a');
  const b = makeLeftover('Chili', 2, new Date(2026, 10, 7), 'b');
  assert.deepEqual(leftoversFirst([item({}), a, b]).map((i) => i.id), ['b', 'a']);
  const { inventory } = cookRecipe([a], {
    id: 'r',
    title: 'Chili',
    minutes: 30,
    servings: 4,
    ingredients: [{ name: 'chili', quantity: 1, unit: 'each' }],
    steps: [],
  });
  assert.equal(inventory[0].quantity, 2);
});

test('check date and leftover flag survive sync', () => {
  const l = { ...makeLeftover('Chili', 2, NOW, 'a'), checkedAt: NOW.toISOString(), price: undefined };
  assert.deepEqual(rowToItem(itemToRow(l, 'h')), l);
  const plain = item({ price: undefined });
  assert.deepEqual(rowToItem(itemToRow(plain, 'h')), plain);
});
