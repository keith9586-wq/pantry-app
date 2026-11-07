import { ingredientConflict, type DietProfile } from './diet';
import type { Category } from './types';

/** One bought item, kept for monthly views of what the household buys. */
export interface Purchase {
  at: string; // ISO
  key: string;
  name: string;
  category: Category;
  price?: number;
}

/** Purchases kept on the phone: a few months of normal shopping. */
export const MAX_PURCHASES = 1500;

const SUGARY = /\b(soda|cola|pop|candy|candies|gumm(y|ies)|chocolate|cookies?|cake|cupcakes?|donuts?|doughnuts?|brownies?|ice cream|syrup|frosting|sweet tea|energy drink|lemonade|marshmallows?|pastr(y|ies)|pop tarts?|sweetened)\b/;
const PROCESSED = /\b(chips|crisps|soda|cola|candy|cookies?|crackers|frozen (pizza|dinner|meal)s?|pizza rolls|nuggets?|hot dogs?|sausages?|bacon|deli|lunch ?meat|salami|pepperoni|instant noodles?|ramen|mac and cheese|boxed|microwave|snack cakes?|pop tarts?|cereal bars?|granola bars?|energy drink|frozen waffles?|toaster|spread|whipped topping|processed cheese|american cheese)\b/;

export const isSugary = (name: string) => SUGARY.test(name.toLowerCase());
/** A rough reading of "ultra-processed" from the product name and aisle. */
export const isProcessed = (name: string, category: Category) =>
  PROCESSED.test(name.toLowerCase()) || (category === 'snacks' && !/\b(nuts?|almonds?|fruit|raisins?|seeds?)\b/.test(name.toLowerCase()));

export interface CartHealth {
  /** Items bought in the month. */
  items: number;
  /** True when shares are by money spent; false when too few prices are known and items are counted instead. */
  bySpend: boolean;
  produce: number;
  sugary: number;
  processed: number;
  /** Items that didn't fit the diet profile, with why. */
  offDiet: { name: string; why: string }[];
}

const inMonth = (iso: string, now: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/** Shares (0..1) of a month's shopping that went to produce, sugary food and highly processed food. */
export function cartHealth(purchases: Purchase[], profile: DietProfile, now = new Date()): CartHealth | null {
  const month = purchases.filter((p) => inMonth(p.at, now));
  if (month.length < 5) return null;
  const priced = month.filter((p) => p.price !== undefined && p.price > 0);
  // Weigh by money when most lines have a price; otherwise one item is one vote.
  const bySpend = priced.length >= month.length * 0.7;
  const rows = bySpend ? priced : month;
  const weight = (p: Purchase) => (bySpend ? p.price! : 1);
  const total = rows.reduce((s, p) => s + weight(p), 0) || 1;
  const share = (f: (p: Purchase) => boolean) => Math.round((rows.filter(f).reduce((s, p) => s + weight(p), 0) / total) * 100) / 100;

  const offDiet: CartHealth['offDiet'] = [];
  const seen = new Set<string>();
  for (const p of month) {
    if (seen.has(p.key)) continue;
    const why = ingredientConflict({ name: p.name, quantity: 1, unit: 'each' }, profile);
    if (why && why !== "You don't like it") {
      offDiet.push({ name: p.name, why });
      seen.add(p.key);
    }
  }

  return {
    items: month.length,
    bySpend,
    produce: share((p) => p.category === 'produce'),
    sugary: share((p) => isSugary(p.name)),
    processed: share((p) => isProcessed(p.name, p.category)),
    offDiet,
  };
}

/** The same month last year is too far; compare with the month before. */
export function previousMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 15);
}

/** "up 6 points" / "down 3 points" / null when there's nothing to compare. */
export function trend(now: number, before: number | undefined): string | null {
  if (before === undefined) return null;
  const pts = Math.round((now - before) * 100);
  if (Math.abs(pts) < 2) return 'about the same as last month';
  return `${pts > 0 ? 'up' : 'down'} ${Math.abs(pts)} points from last month`;
}
