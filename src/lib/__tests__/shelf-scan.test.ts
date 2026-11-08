/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFrames, sanitizeShelfLines, sweepCost } from '../shelfScan';
import { SWEEPS_PER_MONTH, sweepsLeft } from '../plans';

test('shelf lines are validated and filled in', () => {
  const lines = sanitizeShelfLines({
    items: [
      { name: '  Greek   yogurt ', quantity: 2, unit: 'Each', category: 'dairy', storage: 'fridge', fill: 'full' },
      { name: 'Spinach', quantity: -1, unit: '', category: 'nonsense', storage: 'garage', fill: 'empty' },
      { name: '', quantity: 1 },
      'junk',
      { name: 'Rice', quantity: 1e9, unit: 'bag', category: 'grains', storage: 'pantry', fill: 'half' },
    ],
  });
  assert.deepEqual(lines, [
    { name: 'Greek yogurt', quantity: 2, unit: 'each', category: 'dairy', storage: 'fridge', fill: 'full' },
    { name: 'Spinach', quantity: 1, unit: 'each', category: 'produce', storage: 'fridge', fill: 'full' },
    { name: 'Rice', quantity: 50, unit: 'bag', category: 'grains', storage: 'pantry', fill: 'half' },
  ]);
});

test('an item seen in overlapping frames is kept once with the larger count', () => {
  const lines = sanitizeShelfLines({
    items: [
      { name: 'Eggs', quantity: 1, unit: 'carton', category: 'eggs', storage: 'fridge', fill: 'full' },
      { name: 'eggs', quantity: 2, unit: 'carton', category: 'eggs', storage: 'fridge', fill: 'full' },
      { name: 'Peas', quantity: 1, unit: 'bag', category: 'frozen', storage: 'freezer', fill: 'full' },
      { name: 'Peas', quantity: 1, unit: 'can', category: 'canned', storage: 'pantry', fill: 'full' },
    ],
  });
  assert.equal(lines.length, 3);
  assert.equal(lines.find((l) => l.name.toLowerCase() === 'eggs')?.quantity, 2);
});

test('bad responses give an empty list', () => {
  assert.deepEqual(sanitizeShelfLines(null), []);
  assert.deepEqual(sanitizeShelfLines({ items: 'no' }), []);
});

test('frames are spread evenly across the sweep', () => {
  const all = Array.from({ length: 20 }, (_, i) => i);
  const picked = pickFrames(all, 8);
  assert.equal(picked.length, 8);
  assert.equal(picked[0], 0);
  assert.equal(picked[7], 19);
  assert.deepEqual(pickFrames([1, 2, 3], 8), [1, 2, 3]);
});

test('a full sweep costs about seven cents', () => {
  const cost = sweepCost(8);
  assert.ok(cost > 0.06 && cost < 0.08, String(cost));
});

test('sweeps have a monthly allowance on every plan', () => {
  const NOW = new Date(2026, 10, 15);
  const thisMonth = new Date(2026, 10, 2).toISOString();
  const lastMonth = new Date(2026, 9, 30).toISOString();
  assert.equal(sweepsLeft('free', [], NOW), SWEEPS_PER_MONTH.free);
  assert.equal(sweepsLeft('free', [thisMonth, lastMonth], NOW), 1);
  assert.equal(sweepsLeft('free', [thisMonth, thisMonth, thisMonth], NOW), 0);
  assert.equal(sweepsLeft('plus', [thisMonth], NOW), SWEEPS_PER_MONTH.plus - 1);
  assert.ok(SWEEPS_PER_MONTH.family >= SWEEPS_PER_MONTH.plus);
});
