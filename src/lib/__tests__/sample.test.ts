/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_GROCERIES, sampleInputs } from '../../data/sample';
import { RECIPES } from '../../data/recipes';
import { daysLeft, predictExpiry } from '../expiry';
import { defaultStorage, ingredientKey } from '../normalize';
import { rankRecipes } from '../recipes';
import type { InventoryItem } from '../types';

test('sample groceries make a good first impression', () => {
  const now = new Date(2026, 10, 7, 12);
  const inputs = sampleInputs(now);
  assert.equal(inputs.length, SAMPLE_GROCERIES.length);
  const items: InventoryItem[] = inputs.map((i, n) => {
    const key = ingredientKey(i.name);
    const storage = defaultStorage(i.category, i.name);
    const expiresAt = 'expiresAt' in i && i.expiresAt ? i.expiresAt : predictExpiry(key, i.category, storage, now).toISOString();
    return { id: String(n), name: i.name, key, category: i.category, storage, quantity: i.quantity, unit: i.unit, fill: 'full', addedAt: now.toISOString(), expiresAt, expirySource: 'predicted', price: i.price };
  });
  // Something needs using soon, so the Kitchen tab and reminders have something to show.
  const soon = items.filter((i) => (daysLeft(i.expiresAt, now) ?? 99) <= 3);
  assert.ok(soon.length >= 2);
  // At least two recipes can be made with nothing missing, and the top one rescues expiring food.
  const ranked = rankRecipes(items, RECIPES, now);
  assert.ok(ranked.filter((m) => m.missing.length === 0).length >= 2, ranked.map((m) => `${m.recipe.title}:${m.missing.map((x) => x.name)}`).join(' | '));
  assert.ok(ranked[0].rescues.length > 0);
});
