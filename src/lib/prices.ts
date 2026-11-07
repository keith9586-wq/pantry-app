import { ingredientKey } from './normalize';
import type { ShoppingItem } from './types';

/** One purchase of an item at a known price. */
export interface PricePoint {
  at: string; // ISO timestamp
  /** Price per unit, e.g. per lb or per each. */
  unitPrice: number;
  unit: string;
}

export interface PriceEntry {
  name: string;
  points: PricePoint[]; // newest first
}

export type PriceHistory = Record<string, PriceEntry>;

const MAX_POINTS = 12;
const round = (n: number) => Math.round(n * 100) / 100;

/** Adds the priced lines of a receipt to the history. Lines without a price are skipped. */
export function recordPrices(
  history: PriceHistory,
  lines: { name: string; quantity?: number; unit?: string; price?: number }[],
  at: Date,
): PriceHistory {
  const next = { ...history };
  for (const l of lines) {
    if (l.price === undefined || !(l.price > 0)) continue;
    const qty = l.quantity && l.quantity > 0 ? l.quantity : 1;
    const key = ingredientKey(l.name);
    if (!key) continue;
    const point: PricePoint = { at: at.toISOString(), unitPrice: round(l.price / qty), unit: l.unit || 'each' };
    const prev = next[key];
    next[key] = { name: prev?.name ?? l.name, points: [point, ...(prev?.points ?? [])].slice(0, MAX_POINTS) };
  }
  return next;
}

export interface PriceInsight {
  key: string;
  name: string;
  unit: string;
  last: number;
  /** Average of earlier purchases in the same unit. */
  usual: number | null;
  lowest: number;
  /** last vs. usual, e.g. 0.12 for 12% more. Null with no earlier purchase. */
  change: number | null;
  purchases: number;
}

/** Compares the latest price of an item with what you usually pay, same unit only. */
export function priceInsight(key: string, entry: PriceEntry): PriceInsight | null {
  const [latest, ...rest] = entry.points;
  if (!latest) return null;
  const same = rest.filter((p) => p.unit === latest.unit);
  const usual = same.length ? round(same.reduce((s, p) => s + p.unitPrice, 0) / same.length) : null;
  const all = [latest, ...same];
  return {
    key,
    name: entry.name,
    unit: latest.unit,
    last: latest.unitPrice,
    usual,
    lowest: Math.min(...all.map((p) => p.unitPrice)),
    change: usual ? round((latest.unitPrice - usual) / usual) : null,
    purchases: all.length,
  };
}

/** Items whose latest price moved at least `threshold` from usual, biggest moves first. */
export function priceChanges(history: PriceHistory, threshold = 0.1): PriceInsight[] {
  return Object.entries(history)
    .map(([k, e]) => priceInsight(k, e))
    .filter((i): i is PriceInsight => !!i && i.change !== null && Math.abs(i.change) >= threshold)
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!));
}

/** Rough cost of a shopping list from the last price paid for each item. */
export function estimateList(history: PriceHistory, list: ShoppingItem[]): { total: number; priced: number } {
  let total = 0;
  let priced = 0;
  for (const s of list) {
    if (s.checked) continue;
    const p = history[s.key]?.points[0];
    if (!p) continue;
    // Weighed items are estimated as one unit (1 lb), which is a fair typical buy.
    total += p.unitPrice;
    priced += 1;
  }
  return { total: round(total), priced };
}

/** Short label for a receipt line, e.g. "12% more than usual". Null when there is nothing to say. */
export function changeLabel(change: number | null): string | null {
  if (change === null) return null;
  const pct = Math.round(Math.abs(change) * 100);
  if (pct < 5) return 'usual price';
  return change > 0 ? `${pct}% more than usual` : `${pct}% less than usual`;
}

/** What the history says about a line about to be added, before it is recorded. */
export function lineChange(history: PriceHistory, line: { name: string; quantity?: number; unit?: string; price?: number }): number | null {
  if (line.price === undefined) return null;
  const entry = history[ingredientKey(line.name)];
  if (!entry) return null;
  const unit = line.unit || 'each';
  const same = entry.points.filter((p) => p.unit === unit);
  if (!same.length) return null;
  const usual = same.reduce((s, p) => s + p.unitPrice, 0) / same.length;
  const unitPrice = line.price / (line.quantity && line.quantity > 0 ? line.quantity : 1);
  return round((unitPrice - usual) / usual);
}
