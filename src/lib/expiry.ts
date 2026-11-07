import type { Category, StorageSpot } from './types';

const DAY = 24 * 60 * 60 * 1000;

/** Typical shelf life in days by category and where it is kept. */
const CATEGORY_DAYS: Record<Category, Record<StorageSpot, number>> = {
  produce: { fridge: 7, pantry: 5, freezer: 240 },
  dairy: { fridge: 10, pantry: 1, freezer: 90 },
  eggs: { fridge: 28, pantry: 7, freezer: 300 },
  meat: { fridge: 3, pantry: 0, freezer: 120 },
  seafood: { fridge: 2, pantry: 0, freezer: 90 },
  bakery: { fridge: 10, pantry: 5, freezer: 90 },
  frozen: { fridge: 3, pantry: 0, freezer: 180 },
  grains: { fridge: 365, pantry: 365, freezer: 365 },
  canned: { fridge: 5, pantry: 730, freezer: 730 },
  condiments: { fridge: 180, pantry: 365, freezer: 365 },
  snacks: { fridge: 60, pantry: 60, freezer: 120 },
  beverages: { fridge: 10, pantry: 180, freezer: 180 },
  other: { fridge: 7, pantry: 90, freezer: 120 },
};

/** Item-specific overrides (fridge / pantry days) where the category average is misleading. */
const ITEM_DAYS: [RegExp, Partial<Record<StorageSpot, number>>][] = [
  [/berr/, { fridge: 4, pantry: 1 }],
  [/banana/, { pantry: 5, fridge: 7 }],
  [/avocado/, { pantry: 4, fridge: 7 }],
  [/spinach|lettuce|salad|greens|arugula|herb|coriander|basil/, { fridge: 5 }],
  [/potato|onion|garlic/, { pantry: 30 }],
  [/carrot|cabbage/, { fridge: 21 }],
  [/apple/, { pantry: 7, fridge: 30 }],
  [/citrus|lemon|lime|orange/, { fridge: 21, pantry: 7 }],
  [/milk/, { fridge: 7 }],
  [/cheddar|parmesan|hard cheese/, { fridge: 30 }],
  [/yogurt/, { fridge: 14 }],
  [/butter/, { fridge: 60 }],
  [/ground|mince/, { fridge: 2 }],
  [/bacon|ham|deli/, { fridge: 7 }],
  [/bread|bagel/, { pantry: 5 }],
  [/tortilla/, { pantry: 10, fridge: 21 }],
];

export function shelfLifeDays(key: string, category: Category, storage: StorageSpot): number {
  for (const [re, days] of ITEM_DAYS) {
    if (re.test(key) && days[storage] !== undefined) return days[storage]!;
  }
  const d = CATEGORY_DAYS[category][storage];
  // Perishables left out of the fridge still last at least a day.
  return Math.max(d, 1);
}

export function predictExpiry(key: string, category: Category, storage: StorageSpot, purchasedAt: Date): Date {
  return new Date(purchasedAt.getTime() + shelfLifeDays(key, category, storage) * DAY);
}

/** Whole days until expiry, negative once expired. Compares calendar days, not hours. */
export function daysLeft(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null;
  const end = new Date(expiresAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((startOfEnd - startOfToday) / DAY);
}

export type Urgency = 'expired' | 'today' | 'soon' | 'ok' | 'unknown';

export function urgency(expiresAt: string | null, now: Date = new Date()): Urgency {
  const d = daysLeft(expiresAt, now);
  if (d === null) return 'unknown';
  if (d < 0) return 'expired';
  if (d === 0) return 'today';
  if (d <= 3) return 'soon';
  return 'ok';
}

export function expiryLabel(expiresAt: string | null, now: Date = new Date()): string {
  const d = daysLeft(expiresAt, now);
  if (d === null) return 'no date';
  if (d < -1) return `expired ${-d} days ago`;
  if (d === -1) return 'expired yesterday';
  if (d === 0) return 'use today';
  if (d === 1) return '1 day left';
  if (d > 60) return `${Math.round(d / 30)} months left`;
  return `${d} days left`;
}
