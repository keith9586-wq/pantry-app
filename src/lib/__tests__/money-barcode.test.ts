/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moneyStats } from '../money';
import { productFromOpenFoodFacts } from '../barcode';

const NOW = new Date(2026, 10, 15);
const at = (m: number, d: number) => new Date(2026, m, d).toISOString();

test('moneyStats sums this month only and ranks most-tossed items', () => {
  const s = moneyStats(
    [
      { name: 'Spinach', price: 3, at: at(10, 2), outcome: 'tossed' },
      { name: 'spinach', price: 1.5, at: at(9, 20), outcome: 'tossed' },
      { name: 'Milk', price: 2, at: at(10, 3), outcome: 'tossed' },
      { name: 'Eggs', price: 4, at: at(10, 4), outcome: 'used' },
      { name: 'Rice', at: at(10, 5), outcome: 'used' },
    ],
    NOW,
  );
  assert.equal(s.usedValue, 4);
  assert.equal(s.tossedValue, 5);
  assert.equal(s.usedCount, 2);
  assert.equal(s.tossedCount, 2);
  assert.ok(Math.abs(s.wasteRate - 5 / 9) < 1e-9);
  assert.equal(s.mostTossed[0].name, 'Spinach');
  assert.equal(s.mostTossed[0].times, 2);
});

test('productFromOpenFoodFacts maps known products and rejects unknown ones', () => {
  const p = productFromOpenFoodFacts({
    status: 1,
    product: { product_name: 'Greek Yogurt', brands: 'Fage, Other', categories_tags: ['en:dairies'] },
  });
  assert.equal(p?.name, 'Greek Yogurt (Fage)');
  assert.equal(p?.category, 'dairy');
  assert.equal(productFromOpenFoodFacts({ status: 0 }), null);
  assert.equal(productFromOpenFoodFacts({ status: 1, product: { brands: 'X' } }), null);
});

import { bestPlan, can, planFromEntitlements, planFromHousehold, scansLeft } from '../plans';

test('plans gate features and count free scans per month', () => {
  assert.equal(can('free', 'recipes'), false);
  assert.equal(can('plus', 'recipes'), true);
  assert.equal(can('plus', 'createHousehold'), false);
  assert.equal(can('family', 'createHousehold'), true);
  assert.equal(planFromEntitlements(['plus', 'family']), 'family');
  assert.equal(planFromEntitlements([]), 'free');
  assert.equal(bestPlan('free', 'family', 'plus'), 'family');
  assert.equal(planFromHousehold('2026-12-01T00:00:00Z', NOW), 'family');
  assert.equal(planFromHousehold('2026-11-01T00:00:00Z', NOW), 'free');
  assert.equal(planFromHousehold(null, NOW), 'free');
  const log = [at(10, 1), at(10, 2), at(9, 30)];
  assert.equal(scansLeft('free', log, NOW), 3);
  assert.equal(scansLeft('plus', log, NOW), Infinity);
  assert.equal(scansLeft('free', [at(10, 1), at(10, 2), at(10, 3), at(10, 4), at(10, 5), at(10, 6)], NOW), 0);
});

import { changeLabel, estimateList, lineChange, priceChanges, recordPrices } from '../prices';

test('price tracking compares the latest price with what you usually pay', () => {
  let h = recordPrices({}, [{ name: 'Whole Milk', quantity: 1, unit: 'gal', price: 3.4 }], new Date(2026, 9, 1));
  h = recordPrices(h, [{ name: 'Whole Milk', quantity: 1, unit: 'gal', price: 3.6 }, { name: 'Bananas', quantity: 2, unit: 'lb', price: 1.2 }], new Date(2026, 9, 8));
  // A free line and a price for 2 count as per-unit.
  h = recordPrices(h, [{ name: 'milk', quantity: 2, unit: 'gal', price: 8.4 }, { name: 'Napkins' }], new Date(2026, 10, 1));
  assert.equal(h.milk.points.length, 3);
  assert.equal(h.milk.points[0].unitPrice, 4.2);
  assert.equal(h.banana.points[0].unitPrice, 0.6);
  assert.equal(h.napkin, undefined);

  const changes = priceChanges(h);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].key, 'milk');
  assert.equal(changes[0].usual, 3.5);
  assert.equal(changes[0].change, 0.2);
  assert.equal(changes[0].lowest, 3.4);
  assert.equal(changeLabel(changes[0].change), '20% more than usual');

  assert.equal(lineChange(h, { name: 'Milk', quantity: 1, unit: 'gal', price: 3.36 }), -0.1);
  assert.equal(lineChange(h, { name: 'Milk', quantity: 1, unit: 'each', price: 3 }), null);

  const est = estimateList(h, [
    { id: '1', name: 'Milk', key: 'milk', category: 'dairy', checked: false, source: 'manual' },
    { id: '2', name: 'Bananas', key: 'banana', category: 'produce', checked: true, source: 'manual' },
    { id: '3', name: 'Caviar', key: 'caviar', category: 'seafood', checked: false, source: 'manual' },
  ]);
  assert.deepEqual(est, { total: 4.2, priced: 1 });
});
