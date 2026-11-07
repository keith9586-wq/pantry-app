/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PROFILE, fitsProfile, ingredientConflict, ingredientTags, parseDislikes, recipeFit } from '../diet';
import { RECIPES } from '../../data/recipes';
import type { Recipe } from '../types';

const tags = (n: string) => [...ingredientTags(n)].sort();

test('ingredients are tagged by what they contain', () => {
  assert.deepEqual(tags('Boneless Chicken Breasts'), ['meat']);
  assert.deepEqual(tags('chicken broth'), ['meat']);
  assert.deepEqual(tags('Sharp Cheddar'), ['dairy']);
  assert.deepEqual(tags('peanut butter'), ['peanuts']);
  assert.deepEqual(tags('coconut milk'), []);
  assert.deepEqual(tags('eggplant'), []);
  assert.deepEqual(tags('Large Eggs'), ['eggs']);
  assert.deepEqual(tags('soy sauce'), ['gluten', 'soy']);
  assert.deepEqual(tags('gluten free bread'), []);
  assert.deepEqual(tags('vanilla ice cream'), ['dairy']);
  assert.deepEqual(tags('salmon'), ['fish']);
});

const bowl: Recipe = {
  id: 'b',
  title: 'Bowl',
  minutes: 10,
  servings: 1,
  ingredients: [
    { name: 'rice', quantity: 1, unit: 'cup' },
    { name: 'bacon', quantity: 2, unit: 'slice', optional: true },
    { name: 'eggs', quantity: 1, unit: 'each' },
  ],
  steps: [],
};

test('diets and allergies hide recipes, optional ingredients are skipped', () => {
  const veg = { ...EMPTY_PROFILE, diets: ['vegetarian' as const] };
  const fit = recipeFit(bowl, veg);
  assert.equal(fit.blocking.length, 0);
  assert.deepEqual(fit.skip.map((c) => [c.ingredient.name, c.reason]), [['bacon', 'Vegetarian']]);
  assert.ok(fitsProfile(bowl, veg));
  assert.ok(!fitsProfile(bowl, { ...EMPTY_PROFILE, diets: ['vegan'] }));
  // An allergy wins over a diet as the reason.
  assert.equal(ingredientConflict({ name: 'eggs', quantity: 1, unit: 'each' }, { ...EMPTY_PROFILE, diets: ['vegan'], allergies: ['eggs'] }), 'Eggs allergy');
  assert.ok(!fitsProfile(bowl, { ...EMPTY_PROFILE, dislikes: ['Rice'] }));
  assert.deepEqual(parseDislikes(' Mushrooms, olives,\nmushrooms '), ['mushrooms', 'olives']);
  assert.equal(ingredientConflict({ name: 'mushroom', quantity: 1, unit: 'cup' }, { ...EMPTY_PROFILE, dislikes: ['Mushrooms'] }), "You don't like it");
});

test('every built-in recipe gets sensible tags', () => {
  const veg = RECIPES.filter((r) => fitsProfile(r, { ...EMPTY_PROFILE, diets: ['vegetarian'] }));
  const gf = RECIPES.filter((r) => fitsProfile(r, { ...EMPTY_PROFILE, diets: ['glutenFree'] }));
  assert.ok(veg.length > 0 && veg.length < RECIPES.length);
  assert.ok(gf.length > 0 && gf.length < RECIPES.length);
});
