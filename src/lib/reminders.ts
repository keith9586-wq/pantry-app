import type { InventoryItem } from './types';

export interface Reminder {
  at: Date;
  title: string;
  body: string;
}

/**
 * One morning notification per day for food expiring the next day (or that day,
 * if it's still before the reminder hour). Never schedules in the past.
 */
export function planReminders(items: InventoryItem[], now: Date, hour = 9, maxDays = 14): Reminder[] {
  const byDay = new Map<number, InventoryItem[]>();
  for (const it of items) {
    if (!it.expiresAt) continue;
    const exp = new Date(it.expiresAt);
    const expDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    // Remind the morning before it expires.
    let at = new Date(expDay.getFullYear(), expDay.getMonth(), expDay.getDate() - 1, hour);
    if (at <= now) {
      // Too late for the day-before reminder: use the expiry morning if that's still ahead.
      at = new Date(expDay.getFullYear(), expDay.getMonth(), expDay.getDate(), hour);
      if (at <= now) continue;
    }
    const key = at.getTime();
    byDay.set(key, [...(byDay.get(key) ?? []), it]);
  }
  const horizon = now.getTime() + maxDays * 24 * 60 * 60 * 1000;
  return [...byDay.entries()]
    .filter(([t]) => t <= horizon)
    .sort(([a], [b]) => a - b)
    .map(([t, list]) => {
      const names = list.map((i) => i.name);
      const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
      return {
        at: new Date(t),
        title: list.length === 1 ? `Use your ${names[0].toLowerCase()} soon` : `${list.length} items to use up soon`,
        body: `${shown} ${list.length === 1 ? 'expires' : 'expire'} soon. Tap for recipes that use them.`,
      };
    });
}
