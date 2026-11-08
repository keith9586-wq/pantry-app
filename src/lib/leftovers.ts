import type { InventoryItem } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** USDA guidance: cooked leftovers keep 3 to 4 days in the fridge. */
export const LEFTOVER_DAYS = 4;

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Chili (Tuesday)": the day it was made is what people remember about leftovers. */
export function leftoverName(title: string, cookedAt: Date): string {
  return `${title.trim()} (${WEEKDAY[cookedAt.getDay()]})`;
}

/**
 * A cooked dish as an inventory item: counted in portions, kept in the fridge, eat by 4 days.
 * Its key is unique so it never stands in for a recipe ingredient.
 */
export function makeLeftover(title: string, portions: number, cookedAt: Date, id: string): InventoryItem {
  return {
    id,
    name: leftoverName(title, cookedAt),
    key: `leftover:${id}`,
    category: 'other',
    storage: 'fridge',
    quantity: Math.max(1, Math.round(portions)),
    unit: 'portion',
    fill: 'full',
    addedAt: cookedAt.toISOString(),
    expiresAt: new Date(cookedAt.getTime() + LEFTOVER_DAYS * DAY).toISOString(),
    expirySource: 'predicted',
    leftover: true,
  };
}

/** Leftovers first by eat-by date, so the oldest gets eaten first. */
export function leftoversFirst(items: InventoryItem[]): InventoryItem[] {
  return items
    .filter((i) => i.leftover)
    .sort((a, b) => (a.expiresAt ?? '9999').localeCompare(b.expiresAt ?? '9999'));
}
