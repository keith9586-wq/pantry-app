import { daysLeft } from './expiry';
import { ingredientKey, keysMatch } from './normalize';
import type { FillLevel, InventoryItem, Recipe, RecipeIngredient } from './types';

export interface RecipeMatch {
  recipe: Recipe;
  have: RecipeIngredient[];
  missing: RecipeIngredient[];
  /** Pantry items this recipe would use that expire within 3 days. */
  rescues: InventoryItem[];
  score: number;
}

/** Staples most kitchens have; never counted as missing. */
export const ASSUMED = new Set(['salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'vegetable oil']);

export function findItem(inventory: InventoryItem[], ing: RecipeIngredient): InventoryItem | undefined {
  const key = ingredientKey(ing.name);
  // Prefer the item that expires first so cooking uses up the oldest stock.
  return inventory
    .filter((it) => keysMatch(it.key, key))
    .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'))[0];
}

/**
 * Ranks recipes by how much of each you can already make, with a strong
 * bonus for recipes that use food about to expire.
 */
export function rankRecipes(inventory: InventoryItem[], recipes: Recipe[], now: Date = new Date()): RecipeMatch[] {
  const matches = recipes.map((recipe) => {
    const have: RecipeIngredient[] = [];
    const missing: RecipeIngredient[] = [];
    const rescues: InventoryItem[] = [];
    for (const ing of recipe.ingredients) {
      if (ASSUMED.has(ingredientKey(ing.name))) continue;
      const item = findItem(inventory, ing);
      if (item) {
        have.push(ing);
        const d = daysLeft(item.expiresAt, now);
        if (d !== null && d <= 3 && !rescues.includes(item)) rescues.push(item);
      } else if (!ing.optional) {
        missing.push(ing);
      }
    }
    const required = have.length + missing.length || 1;
    const coverage = have.length / required;
    const score = coverage * 100 + rescues.length * 15 - missing.length * 5;
    return { recipe, have, missing, rescues, score };
  });
  return matches
    .filter((m) => m.have.length > 0)
    .sort((a, b) => b.score - a.score || a.recipe.minutes - b.recipe.minutes);
}

const LOWER: Record<FillLevel, FillLevel | null> = { full: 'half', half: 'low', low: null };

/**
 * Subtracts a cooked recipe's ingredients from the inventory.
 * Same unit: subtract the amount. Different units (a recipe asks for "1 cup"
 * of a "1 gal" jug): drop the fill level one step instead of guessing a conversion.
 * Returns the new inventory and the names of items that were used up.
 */
export function cookRecipe(inventory: InventoryItem[], recipe: Recipe): { inventory: InventoryItem[]; usedUp: string[] } {
  let next = inventory.map((it) => ({ ...it }));
  const usedUp: string[] = [];
  for (const ing of recipe.ingredients) {
    if (ASSUMED.has(ingredientKey(ing.name))) continue;
    const item = findItem(next, ing);
    if (!item) continue;
    let gone = false;
    if (item.unit === ing.unit) {
      item.quantity = Math.round((item.quantity - ing.quantity) * 100) / 100;
      gone = item.quantity <= 0;
      if (!gone && item.quantity <= ing.quantity) item.fill = 'low';
    } else {
      const lower = LOWER[item.fill];
      if (lower) item.fill = lower;
      else gone = true;
    }
    if (gone) {
      usedUp.push(item.name);
      next = next.filter((it) => it.id !== item.id);
    }
  }
  return { inventory: next, usedUp };
}
