import { ALLERGEN_LABEL, DIET_LABEL, type Allergen, type Diet, type DietProfile } from '../lib/diet';
import type { PriceHistory, PricePoint } from '../lib/prices';
import type { Category, FillLevel, InventoryItem, Recipe, RecipeIngredient, ShoppingItem, StorageSpot, WasteEntry } from '../lib/types';

/** Database row shapes (snake_case) from supabase/migrations. */
export interface ItemRow {
  id: string;
  household_id: string;
  name: string;
  key: string;
  category: string;
  storage: string;
  quantity: number;
  unit: string;
  fill: string;
  added_at: string;
  expires_at: string | null;
  expiry_source: string;
  price: number | null;
  checked_at?: string | null;
  leftover?: boolean;
}

export interface ShoppingRow {
  id: string;
  household_id: string;
  name: string;
  key: string;
  category: string;
  checked: boolean;
  source: string;
}

export interface EventRow {
  id: string;
  household_id: string;
  name: string;
  outcome: string;
  price: number | null;
  at: string;
}

export const itemToRow = (it: InventoryItem, householdId: string): ItemRow => ({
  id: it.id,
  household_id: householdId,
  name: it.name,
  key: it.key,
  category: it.category,
  storage: it.storage,
  quantity: it.quantity,
  unit: it.unit,
  fill: it.fill,
  added_at: it.addedAt,
  expires_at: it.expiresAt,
  expiry_source: it.expirySource,
  price: it.price ?? null,
  checked_at: it.checkedAt ?? null,
  leftover: !!it.leftover,
});

export const rowToItem = (r: ItemRow): InventoryItem => ({
  id: r.id,
  name: r.name,
  key: r.key,
  category: r.category as Category,
  storage: r.storage as StorageSpot,
  quantity: Number(r.quantity),
  unit: r.unit,
  fill: r.fill as FillLevel,
  addedAt: r.added_at,
  expiresAt: r.expires_at,
  expirySource: r.expiry_source === 'user' ? 'user' : 'predicted',
  price: r.price === null ? undefined : Number(r.price),
  ...(r.checked_at ? { checkedAt: r.checked_at } : {}),
  ...(r.leftover ? { leftover: true } : {}),
});

export const shoppingToRow = (s: ShoppingItem, householdId: string): ShoppingRow => ({
  id: s.id,
  household_id: householdId,
  name: s.name,
  key: s.key,
  category: s.category,
  checked: s.checked,
  source: s.source,
});

export const rowToShopping = (r: ShoppingRow): ShoppingItem => ({
  id: r.id,
  name: r.name,
  key: r.key,
  category: r.category as Category,
  checked: r.checked,
  source: (['auto', 'manual', 'recipe'].includes(r.source) ? r.source : 'manual') as ShoppingItem['source'],
});

export const eventToRow = (e: WasteEntry & { id: string }, householdId: string): EventRow => ({
  id: e.id,
  household_id: householdId,
  name: e.name,
  outcome: e.outcome,
  price: e.price ?? null,
  at: e.at,
});

export const rowToEvent = (r: EventRow): WasteEntry => ({
  id: r.id,
  name: r.name,
  outcome: r.outcome === 'tossed' ? 'tossed' : 'used',
  price: r.price === null ? undefined : Number(r.price),
  at: r.at,
});

export interface RecipeRow {
  id: string;
  household_id: string;
  data: Recipe;
}

export const recipeToRow = (r: Recipe, householdId: string): RecipeRow => ({ id: r.id, household_id: householdId, data: r });

/** Rejects anything that isn't a usable recipe, since any member's phone can write the JSON. */
export function rowToRecipe(r: { id: string; data: unknown }): Recipe | null {
  const d = r.data as Partial<Recipe> | null;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.ingredients)) return null;
  const ingredients = d.ingredients.filter(
    (i): i is RecipeIngredient => !!i && typeof i.name === 'string' && typeof i.quantity === 'number' && typeof i.unit === 'string',
  );
  if (!ingredients.length) return null;
  return {
    id: r.id,
    title: d.title,
    minutes: typeof d.minutes === 'number' ? d.minutes : 30,
    servings: typeof d.servings === 'number' ? d.servings : 2,
    ingredients,
    steps: Array.isArray(d.steps) ? d.steps.filter((s): s is string => typeof s === 'string') : [],
  };
}

/** Price history as rows: one per item key. `id` is the key so the generic diff works. */
export interface PriceRecord {
  id: string;
  name: string;
  points: PricePoint[];
}

export const historyToRecords = (h: PriceHistory): PriceRecord[] => Object.entries(h).map(([id, e]) => ({ id, name: e.name, points: e.points }));

export const recordsToHistory = (rs: PriceRecord[]): PriceHistory => Object.fromEntries(rs.map((r) => [r.id, { name: r.name, points: r.points }]));

export const priceToRow = (r: PriceRecord, householdId: string) => ({ household_id: householdId, key: r.id, name: r.name, points: r.points });

export function rowToPrice(r: { key: string; name: string; points: unknown }): PriceRecord {
  const points = (Array.isArray(r.points) ? r.points : []).filter(
    (p): p is PricePoint => !!p && typeof p.at === 'string' && typeof p.unitPrice === 'number' && typeof p.unit === 'string',
  );
  return { id: r.key, name: r.name, points };
}

/** Joins two copies of the same item's prices, newest first, without repeating a purchase. */
export function mergePoints(a: PricePoint[], b: PricePoint[], max = 12): PricePoint[] {
  const seen = new Set<string>();
  return [...a, ...b]
    .filter((p) => {
      const k = `${p.at}|${p.unitPrice}|${p.unit}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, max);
}

export function mergeHistories(server: PriceRecord[], local: PriceRecord[]): PriceRecord[] {
  const byKey = new Map(server.map((r) => [r.id, r]));
  for (const l of local) {
    const s = byKey.get(l.id);
    byKey.set(l.id, s ? { id: l.id, name: s.name, points: mergePoints(s.points, l.points) } : l);
  }
  return [...byKey.values()];
}

export function rowToDiet(diet: unknown): DietProfile {
  const d = (diet ?? {}) as Partial<DietProfile>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    diets: strings(d.diets).filter((x): x is Diet => x in DIET_LABEL),
    allergies: strings(d.allergies).filter((x): x is Allergen => x in ALLERGEN_LABEL),
    dislikes: strings(d.dislikes),
  };
}
