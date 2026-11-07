/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecipe, parseIngredientLine, parseSteps, toDraft } from '../customRecipe';

const p = (s: string) => parseIngredientLine(s);

test('ingredient lines are read the way people type them', () => {
  assert.deepEqual(p('2 cups flour'), { name: 'flour', quantity: 2, unit: 'cup' });
  assert.deepEqual(p('1 1/2 tbsp. olive oil'), { name: 'olive oil', quantity: 1.5, unit: 'tbsp' });
  assert.deepEqual(p('1/2 cup milk'), { name: 'milk', quantity: 0.5, unit: 'cup' });
  assert.deepEqual(p('½ lb ground beef'), { name: 'ground beef', quantity: 0.5, unit: 'lb' });
  assert.deepEqual(p('3 eggs'), { name: 'eggs', quantity: 3, unit: 'each' });
  assert.deepEqual(p('1 onion, chopped'), { name: 'onion', quantity: 1, unit: 'each' });
  assert.deepEqual(p('- salt to taste'), { name: 'salt', quantity: 1, unit: 'each' });
  assert.deepEqual(p('2-3 cloves garlic'), { name: 'garlic', quantity: 2, unit: 'clove' });
  assert.deepEqual(p('1 can black beans (optional)'), { name: 'black beans', quantity: 1, unit: 'can', optional: true });
  assert.deepEqual(p('2 tomatoes'), { name: 'tomatoes', quantity: 2, unit: 'each' });
  assert.deepEqual(p('1 t cinnamon'), { name: 'cinnamon', quantity: 1, unit: 'tsp' });
  assert.deepEqual(p('1 T butter'), { name: 'butter', quantity: 1, unit: 'tbsp' });
  assert.equal(p('   '), null);
});

test('recipes are built from the form and can be edited again', () => {
  assert.deepEqual(parseSteps('1. Boil water\n\nStep 2: Add pasta\n3) Drain'), ['Boil water', 'Add pasta', 'Drain']);
  assert.deepEqual(buildRecipe({ title: ' ', minutes: '', servings: '', ingredients: 'x', steps: '' }, 'a'), { error: 'Give the recipe a name.' });
  const r = buildRecipe({ title: 'Mac', minutes: '20', servings: 'lots', ingredients: '8 oz pasta\n1 cup cheddar\n\n1 tsp mustard optional', steps: 'Cook' }, 'a');
  assert.ok(!('error' in r));
  if ('error' in r) return;
  assert.equal(r.id, 'my-a');
  assert.equal(r.servings, 2);
  assert.equal(r.ingredients.length, 3);
  assert.equal(r.ingredients[2].optional, true);
  const again = buildRecipe(toDraft(r), r.id);
  assert.deepEqual(again, r);
});
