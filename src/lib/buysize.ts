import type { WasteEntry } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** How far back to look. Long enough to see a pattern, short enough to follow changing habits. */
export const WINDOW_DAYS = 120;
/** Advice only when at least this share of an item ends up in the bin. */
export const MIN_WASTE_SHARE = 0.25;

export interface SizeAdvice {
  key: string;
  name: string;
  /** Share of what was bought that was thrown out, 0..1. */
  wasteShare: number;
  /** Times it was finished (eaten or thrown out) in the window. */
  finished: number;
  /** Typical amount bought, and the amount that would usually get eaten. */
  usual?: { quantity: number; unit: string };
  suggested?: { quantity: number; unit: string };
  /** Money thrown away on it per month, from what was paid. */
  wastedPerMonth: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** A tidy smaller amount: whole items, or quarter steps for weights. */
function smaller(quantity: number, unit: string, keep: number): number {
  const target = quantity * keep;
  if (unit === 'each' || unit === 'pack') return Math.max(1, Math.round(target));
  return Math.max(0.25, Math.round(target * 4) / 4);
}

/**
 * Items people keep throwing part of away, and the size that would usually get eaten.
 * Needs at least 3 finishes, 2 of them partly tossed, in the last 4 months.
 */
export function buySizeAdvice(log: WasteEntry[], now = new Date()): SizeAdvice[] {
  const since = now.getTime() - WINDOW_DAYS * DAY;
  const byKey = new Map<string, WasteEntry[]>();
  for (const e of log) {
    if (!e.key || e.share === undefined || new Date(e.at).getTime() < since) continue;
    byKey.set(e.key, [...(byKey.get(e.key) ?? []), e]);
  }
  const out: SizeAdvice[] = [];
  for (const [key, entries] of byKey) {
    const tossed = entries.filter((e) => (e.share ?? 0) > 0);
    if (entries.length < 3 || tossed.length < 2) continue;
    const wasteShare = entries.reduce((s, e) => s + (e.share ?? 0), 0) / entries.length;
    if (wasteShare < MIN_WASTE_SHARE) continue;

    // Months covered: from the first finish in the window to now, at least one.
    const first = Math.min(...entries.map((e) => new Date(e.at).getTime()));
    const months = Math.max(1, (now.getTime() - first) / (30 * DAY));
    const wastedPerMonth = round2(tossed.reduce((s, e) => s + (e.price ?? 0), 0) / months);

    const sized = entries.filter((e) => e.quantity && e.unit);
    const unit = sized[0]?.unit;
    const sameUnit = unit ? sized.filter((e) => e.unit === unit) : [];
    let usual: SizeAdvice['usual'];
    let suggested: SizeAdvice['suggested'];
    if (unit && sameUnit.length >= 2) {
      const q = median(sameUnit.map((e) => e.quantity!));
      const s = smaller(q, unit, 1 - wasteShare);
      usual = { quantity: q, unit };
      if (s < q) suggested = { quantity: s, unit };
    }
    const name = entries[0].name;
    out.push({ key, name, wasteShare: Math.round(wasteShare * 100) / 100, finished: entries.length, usual, suggested, wastedPerMonth });
  }
  return out.sort((a, b) => b.wastedPerMonth - a.wastedPerMonth || b.wasteShare - a.wasteShare);
}

const fraction = (share: number) =>
  share >= 0.6 ? 'most' : share >= 0.45 ? 'about half' : share >= 0.3 ? 'about a third' : 'about a quarter';

const amount = (q: { quantity: number; unit: string }) => (q.unit === 'each' ? `${q.quantity}` : `${q.quantity} ${q.unit}`);

/** "You throw out about a third of the spinach you buy, about $4.20 a month. Try 1 lb instead of 2 lb." */
export function adviceText(a: SizeAdvice): string {
  const money = a.wastedPerMonth >= 0.5 ? `, about $${a.wastedPerMonth.toFixed(2)} a month` : '';
  const what = `You throw out ${fraction(a.wasteShare)} of the ${a.name.toLowerCase()} you buy${money}.`;
  const tip =
    a.usual && a.suggested
      ? ` Try ${amount(a.suggested)} instead of ${amount(a.usual)}.`
      : ' A smaller pack, or buying it less often, would save most of that.';
  return what + tip;
}

/** Short tag for the shopping list. */
export const adviceTag = (a: SizeAdvice) =>
  a.usual && a.suggested ? `buy ${amount(a.suggested)}, not ${amount(a.usual)}` : 'buy a smaller size';
