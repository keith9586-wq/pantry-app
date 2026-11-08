/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingredientPrice, planBudgetWeek, TYPICAL_PRICE } from '../budget';
import { upcomingDays } from '../planner';
import { RECIPES } from '../../data/recipes';
import type { InventoryItem, Recipe } from '../types';

const NOW = new Date(2026, 10, 10, 12);
const DAY = 24 * 60 * 60 * 1000;

const recipe = (id: string, ingredients: [string, number, string][], servings = 2): Recipe => ({
  id,
  title: id,
  minutes: 20,
  servings,
  ingredients: ingredients.map(([name, quantity, unit]) => ({ name, quantity, unit })),
  steps: [],
});

const item = (name: string, key: string, over: Partial<InventoryItem> = {}): InventoryItem => ({
  id: key,
  name,
  key,
  category: 'other',
  storage: 'fridge',
  quantity: 10,
  unit: 'each',
  fill: 'full',
  addedAt: NOW.toISOString(),
  expiresAt: new Date(NOW.getTime() + 10 * DAY).toISOString(),
  expirySource: 'predicted',
  ...over,
});

test('prices come from receipts when known, else a typical price', () => {
  const prices = { egg: { name: 'Eggs', points: [{ at: NOW.toISOString(), unitPrice: 0.3, unit: 'each' }] } };
  assert.deepEqual(ingredientPrice({ name: 'eggs', quantity: 4, unit: 'each' }, prices, 2), { name: 'eggs', key: 'egg', cost: 2.4, known: true });
  const guess = ingredientPrice({ name: 'ground beef', quantity: 1, unit: 'lb' }, {});
  assert.equal(guess.known, false);
  assert.equal(guess.cost, TYPICAL_PRICE.meat);
});

test('the cheapest dinners come first, and food on hand costs nothing', () => {
  const recipes = [
    recipe('steak night', [['steak', 1, 'lb'], ['potato', 2, 'each']]),
    recipe('egg fried rice', [['egg', 2, 'each'], ['rice', 1, 'cup']]),
  ];
  const inventory = [item('Eggs', 'egg'), item('Rice', 'rice', { unit: 'cup' })];
  const week = planBudgetWeek({ recipes, inventory, prices: {}, people: 2, budget: 20, days: upcomingDays(NOW, 2), now: NOW });
  assert.deepEqual(week.days.map((d) => [d.recipe.id, d.cost]), [['egg fried rice', 0], ['steak night', TYPICAL_PRICE.meat + TYPICAL_PRICE.produce]]);
  assert.equal(week.total, TYPICAL_PRICE.meat + TYPICAL_PRICE.produce);
  assert.equal(week.fits, true);
  assert.equal(week.estimated, true);
});

test('bigger households cook more batches, and over-budget weeks say so', () => {
  const recipes = [recipe('pasta', [['pasta', 1, 'lb'], ['tomato sauce', 1, 'jar']], 2)];
  const week = planBudgetWeek({ recipes, inventory: [], prices: {}, people: 5, budget: 3, days: upcomingDays(NOW, 1), now: NOW });
  assert.equal(week.days[0].batches, 3);
  assert.equal(week.fits, false);
});

test('ingredients bought for one night are not paid for again', () => {
  const recipes = [recipe('a', [['spinach', 1, 'bag']]), recipe('b', [['spinach', 1, 'bag']])];
  const week = planBudgetWeek({ recipes, inventory: [], prices: {}, people: 2, budget: 50, days: upcomingDays(NOW, 2), now: NOW });
  assert.equal(week.shopping.length, 1);
  assert.equal(week.days[1].cost, 0);
});

test('food about to expire pulls a recipe forward', () => {
  const recipes = [recipe('plain', [['rice', 1, 'cup']]), recipe('rescue', [['spinach', 1, 'bag']])];
  const inventory = [
    item('Rice', 'rice', { unit: 'cup' }),
    item('Spinach', 'spinach', { expiresAt: new Date(NOW.getTime() + 1 * DAY).toISOString() }),
  ];
  const week = planBudgetWeek({ recipes, inventory, prices: {}, people: 2, budget: 50, days: upcomingDays(NOW, 1), now: NOW });
  assert.equal(week.days[0].recipe.id, 'rescue');
  assert.deepEqual(week.days[0].rescues, ['Spinach']);
});

test('a week from the built-in recipes plans every night without repeats', () => {
  const week = planBudgetWeek({ recipes: RECIPES, inventory: [], prices: {}, people: 4, budget: 60, days: upcomingDays(NOW, 7), now: NOW });
  assert.equal(week.days.length, 7);
  assert.equal(new Set(week.days.map((d) => d.recipe.id)).size, Math.min(7, RECIPES.length));
});
