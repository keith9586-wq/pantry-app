import { ingredientKey } from './normalize';
import { ASSUMED, findItem } from './recipes';
import type { InventoryItem, Recipe } from './types';

/** Days are keyed by local calendar date, YYYY-MM-DD. */
export type MealPlan = Record<string, string[]>;

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function upcomingDays(now: Date, n = 7): { key: string; label: string }[] {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    return { key: dayKey(d), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${names[d.getDay()]} ${d.getDate()}` };
  });
}

/** Drops days before today so the plan doesn't grow forever. */
export function prunePlan(plan: MealPlan, now: Date): MealPlan {
  const today = dayKey(now);
  return Object.fromEntries(Object.entries(plan).filter(([k, ids]) => k >= today && ids.length > 0));
}

export interface NeededIngredient {
  name: string;
  key: string;
  /** Titles of the planned recipes that need it. */
  forRecipes: string[];
}

/**
 * Everything the week's planned recipes need that isn't in the kitchen,
 * merged across recipes. Optional ingredients and kitchen basics are skipped.
 */
export function missingForPlan(inventory: InventoryItem[], recipes: Recipe[], plan: MealPlan, now: Date): NeededIngredient[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const out = new Map<string, NeededIngredient>();
  for (const ids of Object.values(prunePlan(plan, now))) {
    for (const id of ids) {
      const r = byId.get(id);
      if (!r) continue;
      for (const ing of r.ingredients) {
        const key = ingredientKey(ing.name);
        if (ing.optional || ASSUMED.has(key) || findItem(inventory, ing)) continue;
        const cur = out.get(key) ?? { name: ing.name, key, forRecipes: [] };
        if (!cur.forRecipes.includes(r.title)) cur.forRecipes.push(r.title);
        out.set(key, cur);
      }
    }
  }
  return [...out.values()].sort((a, b) => b.forRecipes.length - a.forRecipes.length || a.name.localeCompare(b.name));
}
