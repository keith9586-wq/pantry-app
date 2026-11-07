import type { Category, FillLevel, InventoryItem, ShoppingItem, StorageSpot, WasteEntry } from '../lib/types';

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
