import { ingredientKey } from './normalize';
import type { PriceHistory } from './prices';
import type { ParsedLine } from './types';

/** One line shared to the area price map. No household, name or time of day goes with it. */
export interface PriceReport {
  zip3: string;
  store: string;
  key: string;
  unit: string;
  unit_price: number;
}

/** A median price from 3 or more people nearby (the area_prices view). */
export interface AreaPrice {
  zip3: string;
  key: string;
  unit: string;
  store: string;
  unit_price: number;
  reporters: number;
  last_seen: string;
}

export interface CheaperNearby {
  key: string;
  name: string;
  store: string;
  unit: string;
  /** What you last paid per unit, and the area median at that store. */
  yours: number;
  theirs: number;
  /** Saving per unit. */
  saving: number;
}

/** First three digits of a US ZIP code: a large area, never a street. */
export function zip3(zip: string): string | null {
  const m = zip.trim().match(/^(\d{3})\d{2}(-\d{4})?$/);
  return m ? m[1] : null;
}

/** "ALDI #1234 SAN JOSE" → "Aldi". Store numbers and addresses would make a receipt identifiable. */
export function normalizeStore(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // The chain name comes first; store numbers and street addresses follow it.
  const words = raw
    .split(/[#\d]/)[0]
    .replace(/\b(store|no)\.?\s*$/i, ' ')
    .replace(/[^A-Za-z&' ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return name.length >= 2 ? name.slice(0, 60) : null;
}

/** Turns a confirmed receipt into anonymous price reports. Needs a store and a ZIP; lines without a price are left out. */
export function reportsFromReceipt(lines: ParsedLine[], store: string | null, zip: string): PriceReport[] {
  const z = zip3(zip);
  const s = normalizeStore(store);
  if (!z || !s) return [];
  const out: PriceReport[] = [];
  for (const l of lines) {
    if (l.price === undefined || !(l.price > 0)) continue;
    const key = ingredientKey(l.name);
    if (!key || key.length > 60) continue;
    const qty = l.quantity > 0 ? l.quantity : 1;
    const unitPrice = Math.round((l.price / qty) * 100) / 100;
    if (!(unitPrice > 0) || unitPrice >= 1000) continue;
    out.push({ zip3: z, store: s, key, unit: (l.unit || 'each').slice(0, 12), unit_price: unitPrice });
  }
  return out;
}

/**
 * Things you buy that cost noticeably less at another store nearby, biggest saving first.
 * Compares like with like: same item and unit, against your most recent price.
 */
export function cheaperNearby(history: PriceHistory, area: AreaPrice[], threshold = 0.1): CheaperNearby[] {
  const best = new Map<string, AreaPrice>();
  for (const a of area) {
    const id = `${a.key}|${a.unit}`;
    const cur = best.get(id);
    if (!cur || Number(a.unit_price) < Number(cur.unit_price)) best.set(id, a);
  }
  const out: CheaperNearby[] = [];
  for (const [key, entry] of Object.entries(history)) {
    const mine = entry.points[0];
    if (!mine) continue;
    const a = best.get(`${key}|${mine.unit}`);
    if (!a) continue;
    const theirs = Number(a.unit_price);
    if (theirs > mine.unitPrice * (1 - threshold)) continue;
    out.push({
      key,
      name: entry.name,
      store: a.store,
      unit: mine.unit,
      yours: mine.unitPrice,
      theirs,
      saving: Math.round((mine.unitPrice - theirs) * 100) / 100,
    });
  }
  return out.sort((a, b) => b.saving / b.yours - a.saving / a.yours);
}

/** "Eggs are $0.10 cheaper per egg at Aldi near you" */
export function cheaperText(c: CheaperNearby): string {
  const per = c.unit === 'each' ? '' : ` per ${c.unit}`;
  return `${c.name}: $${c.theirs.toFixed(2)}${per} at ${c.store} near you, vs $${c.yours.toFixed(2)} you paid.`;
}
