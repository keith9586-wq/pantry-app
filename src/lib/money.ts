import type { WasteEntry } from './types';

const round = (n: number) => Math.round(n * 100) / 100;

export interface MoneyStats {
  usedCount: number;
  tossedCount: number;
  /** Value of food eaten rather than thrown out. */
  usedValue: number;
  tossedValue: number;
  /** Share of tracked grocery value that ended up in the bin, 0..1. */
  wasteRate: number;
  /** Items thrown out most often, all time. */
  mostTossed: { name: string; times: number; value: number }[];
}

/** Money used vs. wasted for the calendar month containing `now`. */
export function moneyStats(log: WasteEntry[], now = new Date()): MoneyStats {
  const inMonth = log.filter((e) => {
    const d = new Date(e.at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const used = inMonth.filter((e) => e.outcome === 'used');
  const tossed = inMonth.filter((e) => e.outcome === 'tossed');
  const usedValue = round(used.reduce((s, e) => s + (e.price ?? 0), 0));
  const tossedValue = round(tossed.reduce((s, e) => s + (e.price ?? 0), 0));

  const byName = new Map<string, { name: string; times: number; value: number }>();
  for (const e of log) {
    if (e.outcome !== 'tossed') continue;
    const k = e.name.toLowerCase();
    const cur = byName.get(k) ?? { name: e.name, times: 0, value: 0 };
    cur.times += 1;
    cur.value = round(cur.value + (e.price ?? 0));
    byName.set(k, cur);
  }
  const mostTossed = [...byName.values()].sort((a, b) => b.times - a.times || b.value - a.value).slice(0, 3);

  const total = usedValue + tossedValue;
  return {
    usedCount: used.length,
    tossedCount: tossed.length,
    usedValue,
    tossedValue,
    wasteRate: total > 0 ? tossedValue / total : 0,
    mostTossed,
  };
}
