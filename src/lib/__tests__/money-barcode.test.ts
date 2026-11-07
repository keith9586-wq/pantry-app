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
