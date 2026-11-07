export type Plan = 'free' | 'plus' | 'family';

export type Feature =
  | 'unlimitedScans'
  | 'recipes'
  | 'autoList'
  | 'savings'
  | 'createHousehold'
  | 'emailReceipts';

const FEATURES: Record<Plan, Feature[]> = {
  free: [],
  plus: ['unlimitedScans', 'recipes', 'autoList', 'savings'],
  family: ['unlimitedScans', 'recipes', 'autoList', 'savings', 'createHousehold', 'emailReceipts'],
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

/** Receipt photo scans left this calendar month; Infinity on paid plans. */
export function scansLeft(plan: Plan, scanLog: string[], now = new Date()): number {
  if (can(plan, 'unlimitedScans')) return Infinity;
  const used = scanLog.filter((iso) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  return Math.max(0, FREE_SCANS_PER_MONTH - used);
}

export const PLAN_COPY: Record<Exclude<Plan, 'free'>, { title: string; fallbackPrice: string; perks: string[] }> = {
  plus: {
    title: 'Plus',
    fallbackPrice: '$4.99/month',
    perks: ['Unlimited receipt scans', 'Recipes from what you have', 'Self-filling shopping list', 'Money saved and wasted'],
  },
  family: {
    title: 'Family',
    fallbackPrice: '$7.99/month',
    perks: ['Everything in Plus', 'One shared kitchen for up to 6 people', 'Forward e-receipts by email'],
  },
};
