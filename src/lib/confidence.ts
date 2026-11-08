import { shelfLifeDays } from './expiry';
import type { InventoryItem } from './types';

const DAY = 24 * 60 * 60 * 1000;

/** How long before a confirmed item is worth asking about again. */
export const RECHECK_AFTER_DAYS = 2;
/** Items above this are trusted and never asked about. */
export const TRUST_ABOVE = 0.7;
export const CHECKS_PER_DAY = 5;

/**
 * How sure the app is that an item is still there as recorded, from 0 to 1.
 * It starts at 1 when bought or confirmed and falls as the item gets older relative to
 * how long that kind of food usually lasts. Low fill and a passed use-by date pull it down.
 */
export function confidence(item: InventoryItem, now = new Date()): number {
  const anchor = new Date(item.checkedAt ?? item.addedAt).getTime();
  const age = Math.max(0, (now.getTime() - anchor) / DAY);
  // Typical life: from the dates on the item when we have them, else from the food type.
  const life = item.expiresAt
    ? Math.max(1, (new Date(item.expiresAt).getTime() - new Date(item.addedAt).getTime()) / DAY)
    : shelfLifeDays(item.key, item.category, item.storage);
  // Long-lasting things (rice, ketchup) get used up long before they spoil, so cap the life used here.
  const horizon = Math.min(life, item.storage === 'freezer' ? 60 : 30);
  let c = 1 - age / horizon;
  if (item.fill === 'half') c -= 0.15;
  if (item.fill === 'low') c -= 0.3;
  if (item.expiresAt && new Date(item.expiresAt).getTime() < now.getTime()) c = Math.min(c, 0.1);
  return Math.max(0, Math.min(1, Math.round(c * 100) / 100));
}

/** The few items worth a quick "still have it?" today, least sure first. */
export function pickChecks(items: InventoryItem[], now = new Date(), max = CHECKS_PER_DAY): InventoryItem[] {
  return items
    .filter((it) => !it.checkedAt || now.getTime() - new Date(it.checkedAt).getTime() >= RECHECK_AFTER_DAYS * DAY)
    .map((it) => ({ it, c: confidence(it, now) }))
    .filter(({ c }) => c < TRUST_ABOVE)
    .sort((a, b) => a.c - b.c)
    .slice(0, max)
    .map(({ it }) => it);
}

/** True when the daily check has already been done today. */
export function checkedToday(lastCheckAt: string | null, now = new Date()): boolean {
  return !!lastCheckAt && new Date(lastCheckAt).toDateString() === now.toDateString();
}
