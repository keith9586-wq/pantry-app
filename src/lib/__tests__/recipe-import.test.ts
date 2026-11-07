/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoMinutes, normalizeUrl, recipeFromHtml } from '../recipeImport';
import { buildRecipe } from '../customRecipe';

const page = (ld: unknown) => `<html><head><script type="application/ld+json">{"@type":"WebSite","name":"x"}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>hi</body></html>`;

test('reads schema.org recipes the way big sites publish them', () => {
  const html = page({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: 'Page' },
      {
        '@type': ['Recipe', 'NewsArticle'],
        name: 'Garlic Butter Pasta &amp; Peas',
        recipeYield: ['4', '4 servings'],
        prepTime: 'PT10M',
        cookTime: 'PT15M',
        recipeIngredient: ['8 ounces spaghetti', '3 tablespoons butter (42g)', '▢ 4 cloves garlic, minced', '1 cup frozen peas', 'salt to taste'],
        recipeInstructions: [
          { '@type': 'HowToSection', name: 'Pasta', itemListElement: [{ '@type': 'HowToStep', text: 'Boil the spaghetti.' }] },
          { '@type': 'HowToStep', text: 'Melt butter, add <b>garlic</b>.' },
          'Toss everything together.',
        ],
      },
    ],
  });
  const d = recipeFromHtml(html);
  assert.deepEqual(d, {
    title: 'Garlic Butter Pasta & Peas',
    minutes: '25',
    servings: '4',
    ingredients: '8 ounces spaghetti\n3 tablespoons butter\n4 cloves garlic, minced\n1 cup frozen peas\nsalt to taste',
    steps: 'Boil the spaghetti.\nMelt butter, add garlic.\nToss everything together.',
  });
  const r = buildRecipe(d!, 'x');
  assert.ok(!('error' in r));
  if ('error' in r) return;
  assert.deepEqual(
    r.ingredients.map((i) => [i.quantity, i.unit, i.name]),
    [
      [8, 'oz', 'spaghetti'],
      [3, 'tbsp', 'butter'],
      [4, 'clove', 'garlic'],
      [1, 'cup', 'frozen peas'],
      [1, 'each', 'salt'],
    ],
  );
});

test('handles HTML instruction strings, totalTime and pages without recipes', () => {
  const d = recipeFromHtml(
    page({ '@type': 'Recipe', name: 'Toast', totalTime: 'PT1H5M', recipeYield: 2, recipeIngredient: ['2 slices bread'], recipeInstructions: '<p>Toast it.</p><p>Butter it.</p>' }),
  );
  assert.equal(d?.minutes, '65');
  assert.equal(d?.servings, '2');
  assert.equal(d?.steps, 'Toast it.\nButter it.');
  assert.equal(recipeFromHtml('<html><script type="application/ld+json">{not json</script></html>'), null);
  assert.equal(recipeFromHtml(page({ '@type': 'Recipe', name: 'Empty', recipeIngredient: [] })), null);
  assert.equal(isoMinutes('P1DT2H'), 1560);
  assert.equal(isoMinutes(undefined), 0);
  assert.equal(normalizeUrl('allrecipes.com/recipe/1'), 'https://allrecipes.com/recipe/1');
  assert.equal(normalizeUrl('hello'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
});
