import type { Recipe, RecipeIngredient } from './types';

/** Unit words people type, mapped to the units the built-in recipes use. */
const UNIT_WORDS: Record<string, string> = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', T: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', t: 'tsp',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  g: 'g', gram: 'g', grams: 'g', kg: 'kg',
  ml: 'ml', l: 'l', liter: 'l', liters: 'l',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  can: 'can', cans: 'can',
  pinch: 'pinch', handful: 'handful', handfuls: 'handful',
  fillet: 'fillet', fillets: 'fillet',
  bunch: 'bunch', bunches: 'bunch',
  pkg: 'package', package: 'package', packages: 'package',
};

const FRACTIONS: Record<string, number> = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125 };

/** Reads "1 1/2", "1½", "0.5", "3/4" or "2-3" (takes the first). Returns the number and the rest of the line. */
function readAmount(s: string): { n: number; rest: string } | null {
  const m = s.match(/^(?:(\d+)\/(\d+)|(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\s*([½⅓⅔¼¾⅛]))?|([½⅓⅔¼¾⅛]))(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*/);
  if (!m) return null;
  let n: number;
  if (m[1]) n = +m[1] / (+m[2] || 1);
  else if (m[3]) n = parseFloat(m[3]) + (m[4] ? +m[4] / (+m[5] || 1) : 0) + (m[6] ? FRACTIONS[m[6]] : 0);
  else n = FRACTIONS[m[7]];
  return { n: Math.round(n * 1000) / 1000, rest: s.slice(m[0].length) };
}

const unitFor = (w: string): string | undefined => {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(UNIT_WORDS, k);
  // Single letters are case-sensitive: T is tablespoon, t is teaspoon.
  if (has(w)) return UNIT_WORDS[w];
  return w.length > 1 && has(w.toLowerCase()) ? UNIT_WORDS[w.toLowerCase()] : undefined;
};

/** "2 cups flour", "1 can black beans (optional)", "salt to taste" -> an ingredient. */
export function parseIngredientLine(line: string): RecipeIngredient | null {
  let s = line.replace(/^[\s•\-*·]+/, '').trim();
  if (!s) return null;
  let optional = false;
  if (/\(optional\)|,?\s*optional$/i.test(s)) {
    optional = true;
    s = s.replace(/\(optional\)|,?\s*optional$/i, '').trim();
  }
  let quantity = 1;
  let unit = 'each';
  const amt = readAmount(s);
  if (amt) {
    quantity = amt.n || 1;
    s = amt.rest;
    const word = s.match(/^([A-Za-z]+)\.?\s+/);
    const u = word ? unitFor(word[1]) : undefined;
    if (word && u) {
      unit = u;
      s = s.slice(word[0].length);
    }
    s = s.replace(/^of\s+/i, '');
  }
  // Drop prep notes: "onion, chopped" -> "onion"; "salt to taste" -> "salt".
  const name = s.split(',')[0].replace(/\s+to taste$/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!name) return null;
  return optional ? { name, quantity, unit, optional } : { name, quantity, unit };
}

export function parseIngredients(text: string): RecipeIngredient[] {
  return text.split('\n').map(parseIngredientLine).filter((x): x is RecipeIngredient => !!x);
}

/** One step per line, with "1." or "Step 1:" numbering removed. */
export function parseSteps(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(step\s*)?\d+[.):]?\s*/i, '').trim())
    .filter(Boolean);
}

export const CUSTOM_PREFIX = 'my-';
export const isCustom = (id: string) => id.startsWith(CUSTOM_PREFIX);

export interface RecipeDraft {
  title: string;
  minutes: string;
  servings: string;
  ingredients: string;
  steps: string;
}

export function buildRecipe(d: RecipeDraft, id: string): Recipe | { error: string } {
  const title = d.title.trim();
  if (!title) return { error: 'Give the recipe a name.' };
  const ingredients = parseIngredients(d.ingredients);
  if (ingredients.length === 0) return { error: 'Add at least one ingredient, one per line.' };
  const num = (s: string, fallback: number) => {
    const n = parseInt(s, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    id: id.startsWith(CUSTOM_PREFIX) ? id : CUSTOM_PREFIX + id,
    title,
    minutes: num(d.minutes, 30),
    servings: num(d.servings, 2),
    ingredients,
    steps: parseSteps(d.steps),
  };
}

/** Turns a saved recipe back into form text for editing. */
export function toDraft(r: Recipe): RecipeDraft {
  return {
    title: r.title,
    minutes: String(r.minutes),
    servings: String(r.servings),
    ingredients: r.ingredients
      .map((i) => `${i.quantity}${i.unit === 'each' ? '' : ` ${i.unit}`} ${i.name}${i.optional ? ' (optional)' : ''}`)
      .join('\n'),
    steps: r.steps.join('\n'),
  };
}
