export type Plan = 'free' | 'plus' | 'family';

export type Feature =
  | 'unlimitedScans'
  | 'recipes'
  | 'autoList'
  | 'mealPlanner'
  | 'savings'
  | 'createHousehold'
  | 'emailReceipts';

const FEATURES: Record<Plan, Feature[]> = {
  free: [],
  plus: ['unlimitedScans', 'recipes', 'autoList', 'mealPlanner', 'savings'],
  family: ['unlimitedScans', 'recipes', 'autoList', 'mealPlanner', 'savings', 'createHousehold', 'emailReceipts'],
};

export const FREE_SCANS_PER_MONTH = 5;

/** RevenueCat entitlement ids. Create entitlements with exactly these names. */
export const ENTITLEMENT = { plus: 'plus', family: 'family' } as const;

export function can(plan: Plan, feature: Feature): boolean {
  return FEATURES[plan].includes(feature);
}

const RANK: Record<Plan, number> = { free: 0, plus: 1, family: 2 };
export const bestPlan = (...plans: Plan[]): Plan => plans.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'free');

export function planFromEntitlements(active: string[]): Plan {
  if (active.includes(ENTITLEMENT.family)) return 'family';
  if (active.includes(ENTITLEMENT.plus)) return 'plus';
  return 'free';
}

/** Household members share the payer's Family plan until it lapses. */
export function planFromHousehold(familyUntil: string | null, now = new Date()): Plan {
  return familyUntil && new Date(familyUntil) > now ? 'family' : 'free';
}

const usedThisMonth = (log: string[], now: Date) =>
  log.filter((iso) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

/** Receipt photo scans left this calendar month; Infinity on paid plans. */
export function scansLeft(plan: Plan, scanLog: string[], now = new Date()): number {
  if (can(plan, 'unlimitedScans')) return Infinity;
  return Math.max(0, FREE_SCANS_PER_MONTH - usedThisMonth(scanLog, now));
}

/**
 * Shelf sweeps (a pan across the fridge or pantry) cost about $0.07 each in AI calls,
 * roughly seven receipt scans, so they have their own monthly allowance on every plan.
 * Free covers a first stock-take of fridge and pantry; paid plans get a fair-use cap.
 */
export const SWEEPS_PER_MONTH: Record<Plan, number> = { free: 2, plus: 20, family: 30 };

export function sweepsLeft(plan: Plan, sweepLog: string[], now = new Date()): number {
  return Math.max(0, SWEEPS_PER_MONTH[plan] - usedThisMonth(sweepLog, now));
}

export const PLAN_COPY: Record<Exclude<Plan, 'free'>, { title: string; fallbackPrice: string; perks: string[] }> = {
  plus: {
    title: 'Plus',
    fallbackPrice: '$4.99/month',
    perks: ['Unlimited receipt scans', '20 shelf sweeps a month', 'Recipes from what you have', 'Weekly meal planner', 'Self-filling shopping list', 'Money saved and wasted'],
  },
  family: {
    title: 'Family',
    fallbackPrice: '$7.99/month',
    perks: ['Everything in Plus', '30 shelf sweeps a month', 'One shared kitchen for up to 6 people', 'Forward e-receipts by email'],
  },
};
