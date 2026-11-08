import { keysMatch } from './normalize';
import type { PriceHistory } from './prices';
import type { Category, InventoryItem } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** Purchase days kept per item, newest first. */
export const MAX_DATES = 10;

export interface PurchaseInfo {
  name: string;
  count: number;
  category: Category;
  /** Days it was bought (ISO), newest first, at most one per day. */
  dates?: string[];
}

export type PurchaseCounts = Record<string, PurchaseInfo>;

export interface RunOut {
  key: string;
  name: string;
  category: Category;
  /** Usual days between purchases. */
  every: number;
  /** Days since it was last bought. */
  since: number;
  /** Days until it usually runs out; 0 or less means now. */
  dueIn: number;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Adds a purchase day, keeping one entry per calendar day. */
export function addPurchaseDate(dates: string[] | undefined, at: Date): string[] {
  const list = dates ?? [];
  if (list.some((d) => dayStart(new Date(d)) === dayStart(at))) return list;
  return [at.toISOString(), ...list].sort((a, b) => b.localeCompare(a)).slice(0, MAX_DATES);
}

/** Purchase days for an item; falls back to price history for people who shopped before dates were kept. */
export function purchaseDates(key: string, info: PurchaseInfo, prices: PriceHistory): string[] {
  if (info.dates?.length) return info.dates;
  const points = prices[key]?.points ?? [];
  return points.reduce<string[]>((acc, p) => addPurchaseDate(acc, new Date(p.at)), []);
}

/** Median gap in days between purchases, or null with fewer than 3 purchases. */
export function buyInterval(dates: string[]): number | null {
  if (dates.length < 3) return null;
  const days = dates.map((d) => dayStart(new Date(d))).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < days.length; i++) gaps.push(Math.round((days[i] - days[i - 1]) / DAY));
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return median >= 1 ? Math.round(median) : null;
}

/**
 * Staples with a steady rhythm, and when each usually runs out.
 * Skipped while a full one bought in the last two days is on hand.
 */
export function forecastRunOuts(
  counts: PurchaseCounts,
  prices: PriceHistory,
  inventory: InventoryItem[],
  now = new Date(),
): RunOut[] {
  const out: RunOut[] = [];
  for (const [key, info] of Object.entries(counts)) {
    const dates = purchaseDates(key, info, prices);
    const every = buyInterval(dates);
    if (!every || every > 60) continue;
    const since = Math.round((dayStart(now) - dayStart(new Date(dates[0]))) / DAY);
    const plenty = inventory.some(
      (it) =>
        keysMatch(it.key, key) &&
        it.fill === 'full' &&
        now.getTime() - new Date(it.addedAt).getTime() < 2 * DAY,
    );
    if (plenty) continue;
    out.push({ key, name: info.name, category: info.category, every, since, dueIn: every - since });
  }
  return out.sort((a, b) => a.dueIn - b.dueIn);
}

/** Staples due by the given number of days from now. */
export const dueWithin = (runOuts: RunOut[], days: number) => runOuts.filter((r) => r.dueIn <= days);

/** "Every 9 days, last bought 8 days ago" */
export function runOutLabel(r: RunOut): string {
  const last = r.since === 0 ? 'today' : r.since === 1 ? 'yesterday' : `${r.since} days ago`;
  return `every ${r.every} days · last ${last}`;
}

/** The weekday the household shops most, from every purchase day; null with too little history. */
export function usualShopDay(counts: PurchaseCounts, prices: PriceHistory): number | null {
  const days = new Set<number>();
  for (const [key, info] of Object.entries(counts)) {
    for (const d of purchaseDates(key, info, prices)) days.add(dayStart(new Date(d)));
  }
  if (days.size < 3) return null;
  const tally = [0, 0, 0, 0, 0, 0, 0];
  for (const t of days) tally[new Date(t).getDay()]++;
  const best = Math.max(...tally);
  // Only a real habit counts: the top weekday holds at least 40% of trips.
  return best / days.size >= 0.4 ? tally.indexOf(best) : null;
}

/** 6 pm the evening before the next usual shop day, if that is still ahead. */
export function nudgeTime(shopDay: number, now = new Date(), hour = 18): Date {
  for (let add = 0; ; add++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
    if (day.getDay() !== shopDay) continue;
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, hour);
    if (at > now) return at;
  }
}
