/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffById, unionById } from '../../sync/diff';
import { itemToRow, rowToItem, rowToShopping, shoppingToRow, eventToRow, rowToEvent } from '../../sync/rows';
import { uuid } from '../id';
import type { InventoryItem } from '../types';

const item: InventoryItem = {
  id: 'a',
  name: 'Milk',
  key: 'milk',
  category: 'dairy',
  storage: 'fridge',
  quantity: 1,
  unit: 'gal',
  fill: 'half',
  addedAt: '2026-11-07T10:00:00.000Z',
  expiresAt: '2026-11-14T10:00:00.000Z',
  expirySource: 'predicted',
  price: 3.48,
};

test('uuid produces valid v4 ids', () => {
  const id = uuid();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(uuid(), id);
});

test('rows round-trip without losing fields', () => {
  assert.deepEqual(rowToItem(itemToRow(item, 'h')), item);
  const noPrice = { ...item, price: undefined };
  assert.deepEqual(rowToItem(itemToRow(noPrice, 'h')), noPrice);
  // Postgres numeric arrives as a string from some drivers.
  assert.equal(rowToItem({ ...itemToRow(item, 'h'), quantity: '2.5' as unknown as number }).quantity, 2.5);
  const sh = { id: 's', name: 'Eggs', key: 'egg', category: 'eggs' as const, checked: true, source: 'auto' as const };
  assert.deepEqual(rowToShopping(shoppingToRow(sh, 'h')), sh);
  const ev = { id: 'e', name: 'Milk', outcome: 'tossed' as const, price: 1.2, at: item.addedAt };
  assert.deepEqual(rowToEvent(eventToRow(ev, 'h')), ev);
});

test('diffById finds changed, added and removed rows', () => {
  const b = { ...item, id: 'b', name: 'Eggs' };
  const c = { ...item, id: 'c', name: 'Bread' };
  const { upserts, deletes } = diffById([item, b], [{ ...item, fill: 'low' }, c]);
  assert.deepEqual(upserts.map((x) => x.id), ['a', 'c']);
  assert.deepEqual(deletes, ['b']);
  assert.deepEqual(diffById([item], [item]), { upserts: [], deletes: [] });
});

test('unionById keeps preferred copies', () => {
  const out = unionById([{ ...item, name: 'Server milk' }], [item, { ...item, id: 'z' }]);
  assert.deepEqual(out.map((x) => `${x.id}:${x.name}`), ['a:Server milk', 'z:Milk']);
});

import { historyToRecords, mergeHistories, recordsToHistory, rowToDiet, rowToPrice, rowToRecipe } from '../../sync/rows';
import { combineProfiles } from '../diet';

test('shared recipes, prices and diets survive the trip and reject junk', () => {
  const recipe = { id: 'my-1', title: 'Mac', minutes: 20, servings: 2, ingredients: [{ name: 'pasta', quantity: 8, unit: 'oz' }], steps: ['Cook'] };
  assert.deepEqual(rowToRecipe({ id: 'my-1', data: recipe }), recipe);
  assert.equal(rowToRecipe({ id: 'x', data: { title: 'Nothing', ingredients: [{ name: 1 }] } }), null);
  assert.equal(rowToRecipe({ id: 'x', data: null }), null);

  const h = { milk: { name: 'Milk', points: [{ at: '2026-11-01', unitPrice: 3.5, unit: 'gal' }] } };
  assert.deepEqual(recordsToHistory(historyToRecords(h)), h);
  assert.deepEqual(rowToPrice({ key: 'milk', name: 'Milk', points: [{ at: 'x', unitPrice: 'free' }, ...h.milk.points] }).points, h.milk.points);

  // Two phones bought milk on different days; the merge keeps both, newest first, once each.
  const server = [{ id: 'milk', name: 'Milk', points: [{ at: '2026-11-01', unitPrice: 3.5, unit: 'gal' }] }];
  const local = [
    { id: 'milk', name: 'Whole milk', points: [{ at: '2026-11-05', unitPrice: 3.8, unit: 'gal' }, { at: '2026-11-01', unitPrice: 3.5, unit: 'gal' }] },
    { id: 'egg', name: 'Eggs', points: [{ at: '2026-11-02', unitPrice: 0.3, unit: 'each' }] },
  ];
  const merged = mergeHistories(server, local);
  assert.deepEqual(merged.map((r) => [r.id, r.name, r.points.map((p) => p.unitPrice)]), [
    ['milk', 'Milk', [3.8, 3.5]],
    ['egg', 'Eggs', [0.3]],
  ]);

  assert.deepEqual(rowToDiet({ diets: ['vegan', 'keto'], allergies: ['peanuts', 7], dislikes: ['olives'] }), {
    diets: ['vegan'],
    allergies: ['peanuts'],
    dislikes: ['olives'],
  });
  assert.deepEqual(rowToDiet(null), { diets: [], allergies: [], dislikes: [] });
  assert.deepEqual(
    combineProfiles([
      { diets: ['vegetarian'], allergies: [], dislikes: ['olives'] },
      { diets: ['vegetarian', 'glutenFree'], allergies: ['peanuts'], dislikes: [] },
    ]),
    { diets: ['vegetarian', 'glutenFree'], allergies: ['peanuts'], dislikes: ['olives'] },
  );
});
