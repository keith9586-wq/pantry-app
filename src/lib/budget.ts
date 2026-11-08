import { daysLeft } from './expiry';
import { guessCategory, ingredientKey, keysMatch } from './normalize';
import type { PriceHistory } from './prices';
import { ASSUMED, cookRecipe, findItem } from './recipes';
import type { Category, InventoryItem, Recipe, RecipeIngredient } from './types';

/** Rough US price of one typical package, for food the household has never bought with a receipt. */
export const TYPICAL_PRICE: Record<Category, number> = {
  produce: 2.5,
  dairy: 3.5,
  eggs: 4,
  meat: 7,
  seafood: 9,
  bakery: 3.5,
  frozen: 4,
  grains: 2.5,
  canned: 1.8,
  condiments: 3.5,
  snacks: 4,
  beverages: 4,
  other: 3,
};

export interface PricedIngredient {
  name: string;
  key: string;
  cost: number;
  /** True when the price comes from the household's own receipts. */
  known: boolean;
}

export interface BudgetDay {
  key: string;
  label: string;
  recipe: Recipe;
  /** Batches cooked to feed everyone. */
  batches: number;
  cost: number;
  buy: PricedIngredient[];
  /** Food on hand this meal uses that would otherwise expire within 3 days. */
  rescues: string[];
}

export interface BudgetWeek {
  days: BudgetDay[];
  total: number;
  budget: number;
  fits: boolean;
  shopping: PricedIngredient[];
  /** True when any price is a typical-price guess rather than the household's own. */
  estimated: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What one purchase of an ingredient costs: the household's last price, else a typical one. */
export function ingredientPrice(ing: RecipeIngredient, prices: PriceHistory, batches = 1): PricedIngredient {
  const key = ingredientKey(ing.name);
  const entry = prices[key] ?? Object.entries(prices).find(([k]) => keysMatch(k, key))?.[1];
  const point = entry?.points[0];
  if (point) {
    // Same unit as the recipe: pay for what's needed (at least one unit). Otherwise one unit of what's sold.
    const qty = point.unit === ing.unit ? Math.max(1, ing.quantity * batches) : 1;
    return { name: ing.name, key, cost: round2(point.unitPrice * qty), known: true };
  }
  return { name: ing.name, key, cost: TYPICAL_PRICE[guessCategory(ing.name)], known: false };
}

/**
 * Plans one dinner a day: each day takes the recipe that needs the least extra money,
 * favouring food on hand that's about to expire. Planned cooking is deducted as it goes,
 * and anything bought once counts as on hand for later meals.
 */
export function planBudgetWeek(opts: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  prices: PriceHistory;
  people: number;
  budget: number;
  days: { key: string; label: string }[];
  now?: Date;
}): BudgetWeek {
  const { recipes, prices, budget, days } = opts;
  const people = Math.max(1, Math.round(opts.people));
  const now = opts.now ?? new Date();
  let inventory = opts.inventory.map((i) => ({ ...i }));
  const bought = new Set<string>();
  const used = new Set<string>();
  const out: BudgetDay[] = [];
  let total = 0;

  const evaluate = (recipe: Recipe) => {
    const batches = Math.max(1, Math.ceil(people / Math.max(1, recipe.servings)));
    const buy: PricedIngredient[] = [];
    const rescues: string[] = [];
    for (const ing of recipe.ingredients) {
      const key = ingredientKey(ing.name);
      if (ASSUMED.has(key)) continue;
      const item = findItem(inventory, ing);
      if (item) {
        const d = daysLeft(item.expiresAt, now);
        if (d !== null && d <= 3 && !rescues.includes(item.name)) rescues.push(item.name);
        continue;
      }
      if (ing.optional || bought.has(key)) continue;
      buy.push(ingredientPrice(ing, prices, batches));
    }
    const cost = round2(buy.reduce((s, b) => s + b.cost, 0));
    // A dollar of rescued food is worth about as much as a dollar saved.
    return { batches, buy, rescues, cost, score: cost - rescues.length * 2 };
  };

  for (const day of days) {
    if (recipes.length === 0) break;
    // Repeat a recipe only once every option has been used.
    const pool = recipes.filter((r) => !used.has(r.id));
    const options = (pool.length ? pool : recipes).map((recipe) => ({ recipe, ...evaluate(recipe) }));
    options.sort((a, b) => a.score - b.score || a.recipe.minutes - b.recipe.minutes);
    const pick = options[0];
    used.add(pick.recipe.id);
    for (const b of pick.buy) bought.add(b.key);
    for (let i = 0; i < pick.batches; i++) inventory = cookRecipe(inventory, pick.recipe).inventory;
    total = round2(total + pick.cost);
    out.push({ key: day.key, label: day.label, recipe: pick.recipe, batches: pick.batches, cost: pick.cost, buy: pick.buy, rescues: pick.rescues });
  }

  const shopping = out.flatMap((d) => d.buy);
  return {
    days: out,
    total,
    budget,
    fits: total <= budget,
    shopping,
    estimated: shopping.some((s) => !s.known),
  };
}
