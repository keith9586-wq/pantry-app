/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dinnersToUse, freezable, freezePatch, isAway, makeTrip, planAway, restockPaused, tripOver } from '../away';
import type { InventoryItem, Recipe } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 10, 12); // Tuesday noon

const item = (name: string, key: string, category: InventoryItem['category'], days: number, over: Partial<InventoryItem> = {}): InventoryItem => ({
  id: key,
  name,
  key,
  category,
  storage: 'fridge',
  quantity: 1,
  unit: 'each',
  fill: 'full',
  addedAt: NOW.toISOString(),
  expiresAt: new Date(NOW.getTime() + days * DAY).toISOString(),
  expirySource: 'predicted',
  ...over,
});

test('a trip runs from local midnight of the leaving day', () => {
  const trip = makeTrip(1, 5, NOW);
  assert.equal(new Date(trip.from).getDate(), 11);
  assert.equal(new Date(trip.until).getDate(), 16);
  assert.equal(isAway(trip, NOW), false);
  assert.equal(isAway(trip, new Date(2026, 10, 12)), true);
  assert.equal(tripOver(trip, new Date(2026, 10, 16, 8)), true);
});

test('fresh restocking pauses from the day before leaving until the return day', () => {
  const trip = makeTrip(2, 3, NOW); // leave Thu 12, back Sun 15
  assert.equal(restockPaused(trip, NOW), false);
  assert.equal(restockPaused(trip, new Date(2026, 10, 11, 9)), true);
  assert.equal(restockPaused(trip, new Date(2026, 10, 14)), true);
  assert.equal(restockPaused(trip, new Date(2026, 10, 15, 9)), false);
  assert.equal(restockPaused(null, NOW), false);
});

test('food that would spoil splits into freeze and eat-first', () => {
  const items = [
    item('Chicken', 'chicken', 'meat', 2),
    item('Spinach', 'spinach', 'produce', 3),
    item('Blueberries', 'blueberry', 'produce', 2),
    item('Milk', 'milk', 'dairy', 4),
    item('Rice', 'rice', 'grains', 300),
    item('Frozen peas', 'pea', 'frozen', 1, { storage: 'freezer' }),
  ];
  const p = planAway(items, makeTrip(1, 5, NOW), NOW);
  assert.deepEqual(p.freeze.map((i) => i.name).sort(), ['Blueberries', 'Chicken']);
  assert.deepEqual(p.eatFirst.map((i) => i.name), ['Spinach', 'Milk']);
  assert.equal(p.nightsBefore, 1);
});

test('freezing moves the item and gives it a freezer date', () => {
  const chicken = item('Chicken', 'chicken', 'meat', 2);
  assert.equal(freezable(chicken), true);
  assert.equal(freezable(item('Lettuce', 'lettuce', 'produce', 2)), false);
  const patch = freezePatch(chicken, NOW);
  assert.equal(patch.storage, 'freezer');
  assert.ok(new Date(patch.expiresAt!).getTime() - NOW.getTime() > 60 * DAY);
});

test('dinners before leaving use the food that would spoil', () => {
  const spinach = item('Spinach', 'spinach', 'produce', 2);
  const milk = item('Milk', 'milk', 'dairy', 3);
  const r = (id: string, names: string[]): Recipe => ({
    id,
    title: id,
    minutes: 20,
    servings: 2,
    ingredients: names.map((name) => ({ name, quantity: 1, unit: 'each' })),
    steps: [],
  });
  const recipes = [r('toast', ['bread']), r('creamed spinach', ['spinach', 'milk']), r('salad', ['spinach'])];
  assert.deepEqual(dinnersToUse([spinach, milk], [spinach, milk], recipes, 2).map((x) => x.id), ['creamed spinach', 'salad']);
  assert.deepEqual(dinnersToUse([spinach], [spinach], recipes, 0), []);
});
