import { predictExpiry } from './expiry';
import { findItem } from './recipes';
import type { Category, InventoryItem, Recipe } from './types';

const DAY = 24 * 60 * 60 * 1000;

export interface AwayTrip {
  /** First day away (ISO, local midnight). */
  from: string;
  /** Day you're back (ISO, local midnight). */
  until: string;
}

/** Fresh food categories: don't restock these right before or during a trip. */
export const PERISHABLE: Category[] = ['produce', 'dairy', 'eggs', 'meat', 'seafood', 'bakery'];

/** Freezes well and is easy to forget: meat, fish, bread, and some fruit. Leafy greens and milk don't. */
export function freezable(item: InventoryItem): boolean {
  if (item.storage === 'freezer') return false;
  if (['meat', 'seafood', 'bakery'].includes(item.category)) return true;
  if (item.category === 'produce') return /berr|banana|mango|peach|grape|corn|pea/.test(item.key);
  if (item.category === 'dairy') return /butter|shredded|cheddar|mozzarella/.test(item.key);
  return false;
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function makeTrip(leaveInDays: number, nights: number, now = new Date()): AwayTrip {
  const from = midnight(new Date(now.getTime() + leaveInDays * DAY));
  const until = new Date(from.getFullYear(), from.getMonth(), from.getDate() + nights);
  return { from: from.toISOString(), until: until.toISOString() };
}

export function isAway(trip: AwayTrip | null, now = new Date()): boolean {
  return !!trip && now >= new Date(trip.from) && now < new Date(trip.until);
}

/** True from the day before leaving until the day you're back: fresh food shouldn't go on the list. */
export function restockPaused(trip: AwayTrip | null, now = new Date()): boolean {
  if (!trip) return false;
  const start = new Date(trip.from).getTime() - DAY;
  return now.getTime() >= start && now.getTime() < new Date(trip.until).getTime();
}

/** The trip is over once the return day has passed. */
export const tripOver = (trip: AwayTrip | null, now = new Date()) => !!trip && now >= new Date(trip.until);

export interface AwayPlan {
  /** Would spoil while away and freezes well. */
  freeze: InventoryItem[];
  /** Would spoil while away: eat before leaving, or give away. */
  eatFirst: InventoryItem[];
  /** Dinners left before leaving. */
  nightsBefore: number;
}

/** What to do with the fridge before a trip. */
export function planAway(items: InventoryItem[], trip: AwayTrip, now = new Date()): AwayPlan {
  const until = new Date(trip.until).getTime();
  const atRisk = items
    .filter((i) => i.expiresAt && new Date(i.expiresAt).getTime() < until && i.storage !== 'freezer')
    .sort((a, b) => (a.expiresAt ?? '').localeCompare(b.expiresAt ?? ''));
  const nightsBefore = Math.max(0, Math.round((new Date(trip.from).getTime() - midnight(now).getTime()) / DAY));
  return {
    freeze: atRisk.filter(freezable),
    eatFirst: atRisk.filter((i) => !freezable(i)),
    nightsBefore,
  };
}

/** The changes to make an item frozen, with a new use-by date from today. */
export function freezePatch(item: InventoryItem, now = new Date()): Pick<InventoryItem, 'storage' | 'expiresAt' | 'expirySource'> {
  return {
    storage: 'freezer',
    expiresAt: predictExpiry(item.key, item.category, 'freezer', now).toISOString(),
    expirySource: 'predicted',
  };
}

/** Up to n recipes that use the most of the food that would spoil, best first, no repeats. */
export function dinnersToUse(items: InventoryItem[], atRisk: InventoryItem[], recipes: Recipe[], n: number): Recipe[] {
  if (n <= 0 || atRisk.length === 0) return [];
  const risky = new Set(atRisk.map((i) => i.id));
  return recipes
    .map((r) => {
      const uses = new Set<string>();
      for (const ing of r.ingredients) {
        const it = findItem(items, ing);
        if (it && risky.has(it.id)) uses.add(it.id);
      }
      return { r, uses: uses.size };
    })
    .filter((x) => x.uses > 0)
    .sort((a, b) => b.uses - a.uses || a.r.minutes - b.r.minutes)
    .slice(0, n)
    .map((x) => x.r);
}
