import type { Category } from '../lib/types';

export interface SampleItem {
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  price: number;
  /** Days until it expires; leave out to use the predicted date. */
  days?: number;
}

/** A small, realistic first shop so new users can try recipes and reminders right away. */
export const SAMPLE_GROCERIES: SampleItem[] = [
  { name: 'Eggs', quantity: 12, unit: 'each', category: 'eggs', price: 4.12 },
  { name: 'Whole Milk', quantity: 1, unit: 'gal', category: 'dairy', price: 3.48 },
  { name: 'Baby Spinach', quantity: 5, unit: 'oz', category: 'produce', price: 2.99, days: 2 },
  { name: 'Chicken Breast', quantity: 1.5, unit: 'lb', category: 'meat', price: 6.75, days: 1 },
  { name: 'Cheddar', quantity: 8, unit: 'oz', category: 'dairy', price: 3.29 },
  { name: 'Tomatoes', quantity: 4, unit: 'each', category: 'produce', price: 2.4, days: 3 },
  { name: 'Onion', quantity: 2, unit: 'each', category: 'produce', price: 1.1 },
  { name: 'Garlic', quantity: 1, unit: 'each', category: 'produce', price: 0.6 },
  { name: 'Rice', quantity: 2, unit: 'lb', category: 'grains', price: 2.49 },
  { name: 'Pasta', quantity: 1, unit: 'lb', category: 'grains', price: 1.39 },
  { name: 'Bread', quantity: 1, unit: 'each', category: 'bakery', price: 2.99, days: 4 },
  { name: 'Bananas', quantity: 6, unit: 'each', category: 'produce', price: 1.62 },
];

/** Turns the sample into store inputs with dates relative to `now`. */
export function sampleInputs(now: Date) {
  return SAMPLE_GROCERIES.map(({ days, ...rest }) => {
    if (days === undefined) return rest;
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(20, 0, 0, 0);
    return { ...rest, expiresAt: d.toISOString() };
  });
}
