/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartHealth, isProcessed, isSugary, previousMonth, trend, type Purchase } from '../cartHealth';
import { EMPTY_PROFILE } from '../diet';

const NOW = new Date(2026, 10, 20);
const at = (m: number, d: number) => new Date(2026, m, d).toISOString();
const p = (name: string, category: Purchase['category'], price?: number, when = at(10, 5)): Purchase => ({
  at: when,
  key: name.toLowerCase(),
  name,
  category,
  price,
});

test('sugary and processed food is spotted by name', () => {
  assert.equal(isSugary('Cola 12 pack'), true);
  assert.equal(isSugary('Chocolate chip cookies'), true);
  assert.equal(isSugary('Greek yogurt'), false);
  assert.equal(isProcessed('Potato chips', 'snacks'), true);
  assert.equal(isProcessed('Frozen pizza', 'frozen'), true);
  assert.equal(isProcessed('Roasted almonds', 'snacks'), false);
  assert.equal(isProcessed('Carrots', 'produce'), false);
});

test('shares are by money spent when prices are known', () => {
  const month = [
    p('Spinach', 'produce', 4),
    p('Apples', 'produce', 6),
    p('Cola', 'beverages', 5),
    p('Potato chips', 'snacks', 5),
    p('Chicken breast', 'meat', 10),
  ];
  const h = cartHealth(month, EMPTY_PROFILE, NOW)!;
  assert.equal(h.bySpend, true);
  assert.equal(h.produce, 0.33);
  assert.equal(h.sugary, 0.17);
  assert.equal(h.processed, 0.33);
});

test('without prices each item counts once', () => {
  const month = ['Spinach', 'Kale', 'Rice', 'Beans', 'Cookies'].map((n, i) => p(n, i < 2 ? 'produce' : 'grains'));
  const h = cartHealth(month, EMPTY_PROFILE, NOW)!;
  assert.equal(h.bySpend, false);
  assert.equal(h.produce, 0.4);
  assert.equal(h.sugary, 0.2);
});

test('too little shopping in the month gives nothing, and other months are ignored', () => {
  assert.equal(cartHealth([p('Milk', 'dairy', 3)], EMPTY_PROFILE, NOW), null);
  const old = ['A', 'B', 'C', 'D', 'E'].map((n) => p(n, 'other', 1, at(9, 5)));
  assert.equal(cartHealth(old, EMPTY_PROFILE, NOW), null);
  assert.notEqual(cartHealth(old, EMPTY_PROFILE, previousMonth(NOW)), null);
});

test('purchases that clash with the diet profile are listed once', () => {
  const month = [p('Bacon', 'meat'), p('Bacon', 'meat'), p('Spinach', 'produce'), p('Rice', 'grains'), p('Tofu', 'other')];
  const h = cartHealth(month, { diets: ['vegetarian'], allergies: [], dislikes: ['tofu'] }, NOW)!;
  assert.deepEqual(h.offDiet.map((o) => o.name), ['Bacon']);
});

test('trends read in points', () => {
  assert.equal(trend(0.3, 0.24), 'up 6 points from last month');
  assert.equal(trend(0.2, 0.25), 'down 5 points from last month');
  assert.equal(trend(0.2, 0.21), 'about the same as last month');
  assert.equal(trend(0.2, undefined), null);
});
