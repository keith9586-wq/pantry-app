import { Platform } from 'react-native';
import { create } from 'zustand';
import { bestPlan, planFromEntitlements, type Plan } from '../lib/plans';

type PurchasesModule = typeof import('react-native-purchases').default;
type Pkg = import('react-native-purchases').PurchasesPackage;

interface PlanState {
  /** False until RevenueCat keys are set; everything is unlocked meanwhile so the app stays usable. */
  configured: boolean;
  ownPlan: Plan;
  householdPlan: Plan;
  packages: Partial<Record<'plus' | 'family', Pkg>>;
}

export const usePlanState = create<PlanState>(() => ({
  configured: false,
  ownPlan: 'family',
  householdPlan: 'free',
  packages: {},
}));

/** The plan that applies right now: your own subscription or your household's Family plan. */
export const usePlan = (): Plan => usePlanState((s) => bestPlan(s.ownPlan, s.householdPlan));
export const setHouseholdPlan = (p: Plan) => usePlanState.setState({ householdPlan: p });

let Purchases: PurchasesModule | null = null;
let started = false;

const apiKey = () =>
  Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

function classify(pkgs: Pkg[]): PlanState['packages'] {
  const out: PlanState['packages'] = {};
  for (const p of pkgs) {
    const id = `${p.identifier} ${p.product.identifier}`.toLowerCase();
    const kind = id.includes('family') ? 'family' : id.includes('plus') ? 'plus' : null;
    // Prefer the monthly package when an offering has several durations.
    if (kind && (!out[kind] || p.packageType === 'MONTHLY')) out[kind] = p;
  }
  return out;
}

/** Starts RevenueCat once. `userId` ties purchases to the Supabase user for household sharing. */
export async function initBilling(userId?: string): Promise<void> {
  const key = apiKey();
  if (!key) return; // stays unlocked, not configured
  try {
    if (!Purchases) Purchases = (require('react-native-purchases') as { default: PurchasesModule }).default;
    if (!started) {
      Purchases.configure({ apiKey: key, appUserID: userId ?? null });
      Purchases.addCustomerInfoUpdateListener((info) =>
        usePlanState.setState({ ownPlan: planFromEntitlements(Object.keys(info.entitlements.active)) }),
      );
      started = true;
    } else if (userId) {
      await Purchases.logIn(userId);
    }
    const [info, offerings] = await Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()]);
    usePlanState.setState({
      configured: true,
      ownPlan: planFromEntitlements(Object.keys(info.entitlements.active)),
      packages: classify(offerings.current?.availablePackages ?? []),
    });
  } catch (e) {
    // Native module missing (Expo Go) or store unavailable: keep the app usable.
    console.warn('Billing unavailable', e);
  }
}

/** Returns true when the purchase went through, false when the user backed out. */
export async function purchase(kind: 'plus' | 'family'): Promise<boolean> {
  const pkg = usePlanState.getState().packages[kind];
  if (!Purchases || !pkg) throw new Error('Subscriptions are not available right now.');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    usePlanState.setState({ ownPlan: planFromEntitlements(Object.keys(customerInfo.entitlements.active)) });
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

export async function restore(): Promise<Plan> {
  if (!Purchases) throw new Error('Subscriptions are not available right now.');
  const info = await Purchases.restorePurchases();
  const plan = planFromEntitlements(Object.keys(info.entitlements.active));
  usePlanState.setState({ ownPlan: plan });
  return plan;
}

/** Shows the trial offer when the store has one, e.g. "7-day free trial". */
export function trialLabel(kind: 'plus' | 'family'): string | null {
  const intro = usePlanState.getState().packages[kind]?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unit = intro.periodUnit.toLowerCase();
  return `${intro.periodNumberOfUnits}-${unit.replace(/s$/, '')} free trial`;
}
