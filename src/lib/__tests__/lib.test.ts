/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientKey, guessCategory, defaultStorage, keysMatch } from '../normalize';
import { predictExpiry, daysLeft, urgency } from '../expiry';
import { parseReceiptText, sanitizeParsedLines } from '../receipt';
import { rankRecipes, cookRecipe } from '../recipes';
import { autoSuggestions, groupByAisle, makeShoppingItem } from '../shopping';
import type { InventoryItem, Recipe } from '../types';

const NOW = new Date(2026, 10, 7, 12, 0, 0);

function item(name: string, over: Partial<InventoryItem> = {}): InventoryItem {
  const key = ingredientKey(name);
  const category = guessCategory(name);
  const storage = defaultStorage(category, name);
  return {
    id: name,
    name,
    key,
    category,
    storage,
    quantity: 1,
    unit: 'each',
    fill: 'full',
    addedAt: NOW.toISOString(),
    expiresAt: predictExpiry(key, category, storage, NOW).toISOString(),
    expirySource: 'predicted',
    ...over,
  };
}

test('ingredientKey normalizes plurals, sizes and synonyms', () => {
  assert.equal(ingredientKey('Large Eggs'), 'egg');
  assert.equal(ingredientKey('eggs'), 'egg');
  assert.equal(ingredientKey('Baby Spinach 5oz'), 'spinach');
  assert.equal(ingredientKey('Tomatoes'), 'tomato');
  assert.equal(ingredientKey('Organic Strawberries'), 'strawberry');
  assert.equal(ingredientKey('Boneless Chicken Breasts'), 'chicken breast');
});

test('keysMatch lets a specific item satisfy a general ingredient', () => {
  assert.ok(keysMatch('chicken breast', 'chicken'));
  assert.ok(!keysMatch('chicken', 'chicken breast'));
});

test('categories and storage are guessed sensibly', () => {
  assert.equal(guessCategory('Whole Milk'), 'dairy');
  assert.equal(guessCategory('Red Bell Pepper'), 'produce');
  assert.equal(guessCategory('Ground Beef'), 'meat');
  assert.equal(defaultStorage('produce', 'banana'), 'pantry');
  assert.equal(defaultStorage('produce', 'spinach'), 'fridge');
});

test('expiry prediction uses item overrides and calendar days', () => {
  const beef = predictExpiry('ground beef', 'meat', 'fridge', NOW);
  assert.equal(daysLeft(beef.toISOString(), NOW), 2);
  const rice = predictExpiry('rice', 'grains', 'pantry', NOW);
  assert.equal(daysLeft(rice.toISOString(), NOW), 365);
  assert.equal(urgency(beef.toISOString(), NOW), 'soon');
  assert.equal(urgency(null, NOW), 'unknown');
});

test('parseReceiptText reads items and skips totals', () => {
  const lines = parseReceiptText(`WALMART STORE #1234
GV WHL MLK 1G        3.48 F
BNNAS 2.1 LB         1.22 N
2 @ ORG SPNCH        5.98
LG EGGS 18CT         4.12
SUBTOTAL            14.80
TAX                  0.00
TOTAL               14.80
VISA TEND           14.80`);
  assert.equal(lines.length, 4);
  assert.equal(lines[0].name, 'Whole Milk');
  assert.equal(lines[0].category, 'dairy');
  assert.equal(lines[1].unit, 'lb');
  assert.equal(lines[1].quantity, 2.1);
  assert.equal(lines[2].quantity, 2);
  assert.equal(lines[3].quantity, 18);
  assert.equal(lines[3].category, 'eggs');
});

test('sanitizeParsedLines rejects bad AI output', () => {
  const out = sanitizeParsedLines({
    items: [
      { name: 'Milk', quantity: 1, unit: 'gal', category: 'dairy', price: 3.5 },
      { name: '', quantity: 1 },
      { name: 'Mystery', quantity: -2, category: 'nonsense' },
      'garbage',
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[1].quantity, 1);
  assert.equal(out[1].category, 'other');
  assert.deepEqual(sanitizeParsedLines(null), []);
});

const omelette: Recipe = {
  id: 'o',
  title: 'Omelette',
  minutes: 10,
  servings: 1,
  ingredients: [
    { name: 'eggs', quantity: 3, unit: 'each' },
    { name: 'spinach', quantity: 1, unit: 'cup' },
    { name: 'salt', quantity: 1, unit: 'pinch' },
  ],
  steps: [],
};
const steak: Recipe = { ...omelette, id: 's', title: 'Steak', ingredients: [{ name: 'steak', quantity: 1, unit: 'each' }, { name: 'egg', quantity: 1, unit: 'each' }] };

test('rankRecipes prefers full coverage and expiring food, ignores salt', () => {
  const inv = [item('eggs', { quantity: 12 }), item('Baby Spinach')];
  const ranked = rankRecipes(inv, [steak, omelette], NOW);
  assert.equal(ranked[0].recipe.id, 'o');
  assert.equal(ranked[0].missing.length, 0);
  assert.equal(ranked[0].rescues.length, 0); // spinach has 5 days
  assert.equal(ranked[1].missing[0].name, 'steak');
});

test('cookRecipe subtracts same units and steps fill level otherwise', () => {
  const inv = [item('eggs', { quantity: 3 }), item('Baby Spinach', { unit: 'oz', quantity: 5 })];
  const r1 = cookRecipe(inv, omelette);
  assert.deepEqual(r1.usedUp, ['eggs']);
  assert.equal(r1.inventory.length, 1);
  assert.equal(r1.inventory[0].fill, 'half');
  const r2 = cookRecipe(r1.inventory, omelette);
  assert.equal(r2.inventory[0].fill, 'low');
  const r3 = cookRecipe(r2.inventory, omelette);
  assert.equal(r3.inventory.length, 0);
});

test('autoSuggestions adds staples that ran out or are low', () => {
  const counts = {
    milk: { name: 'Milk', count: 3, category: 'dairy' as const },
    egg: { name: 'Eggs', count: 2, category: 'eggs' as const },
    caviar: { name: 'Caviar', count: 1, category: 'seafood' as const },
  };
  const inv = [item('eggs', { fill: 'low' })];
  const out = autoSuggestions(inv, counts, []);
  assert.deepEqual(out.map((o) => o.key).sort(), ['egg', 'milk']);
  const onList = autoSuggestions(inv, counts, [makeShoppingItem('Milk', 'manual', '1')]);
  assert.deepEqual(onList.map((o) => o.key), ['egg']);
});

test('groupByAisle orders by store layout', () => {
  const groups = groupByAisle([
    makeShoppingItem('Milk', 'manual', '1'),
    makeShoppingItem('Apples', 'manual', '2'),
  ]);
  assert.deepEqual(groups.map((g) => g.category), ['produce', 'dairy']);
});

import { planReminders } from '../reminders';

test('planReminders groups items into one morning reminder per day', () => {
  const now = new Date(2026, 10, 7, 12, 0); // Nov 7, noon
  const exp = (d: number) => new Date(2026, 10, d, 18).toISOString();
  const r = planReminders(
    [
      item('Milk', { expiresAt: exp(10) }),
      item('Spinach', { expiresAt: exp(10) }),
      item('Bread', { expiresAt: exp(8) }), // day-before reminder (Nov 7 9am) has passed -> Nov 8 9am
      item('Yogurt', { expiresAt: exp(7) }), // expires today, both slots passed -> skipped
      item('Rice', { expiresAt: exp(30) }), // beyond 14-day horizon
      item('Salt', { expiresAt: null }),
    ],
    now,
  );
  assert.equal(r.length, 2);
  assert.equal(r[0].at.getDate(), 8);
  assert.equal(r[0].at.getHours(), 9);
  assert.equal(r[0].title, 'Use your bread soon');
  assert.equal(r[1].at.getDate(), 9);
  assert.equal(r[1].title, '2 items to use up soon');
  assert.match(r[1].body, /Milk, Spinach expire soon/);
});
