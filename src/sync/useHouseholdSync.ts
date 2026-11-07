import { useEffect } from 'react';
import { initBilling, setHouseholdPlan } from '../billing/billing';
import { planFromHousehold } from '../lib/plans';
import { create } from 'zustand';
import { useStore } from '../store/useStore';
import { supabase } from './client';
import { startSync, type SyncStatus } from './engine';
import { ensureSignedIn } from './household';

export const useSyncStatus = create<{ status: SyncStatus; set: (s: SyncStatus) => void }>((set) => ({
  status: 'idle',
  set: (status) => set({ status }),
}));

/** Mount once at the app root: syncs whenever the phone belongs to a household. */
export function useHouseholdSync() {
  const householdId = useStore((s) => s.householdId);
  const setStatus = useSyncStatus((s) => s.set);

  // Billing starts once; with a backend it uses the Supabase user id so the
  // subscription webhook can find the payer's household.
  useEffect(() => {
    if (!supabase) {
      initBilling();
      return;
    }
    ensureSignedIn()
      .then((uid) => initBilling(uid))
      .catch(() => initBilling());
  }, []);

  // Household members share the payer's Family plan.
  useEffect(() => {
    if (!householdId || !supabase) {
      setHouseholdPlan('free');
      return;
    }
    supabase
      .from('households')
      .select('family_until')
      .eq('id', householdId)
      .maybeSingle()
      .then(({ data }) => setHouseholdPlan(planFromHousehold((data?.family_until as string | null) ?? null)));
  }, [householdId]);

  useEffect(() => {
    if (!householdId || !supabase) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    ensureSignedIn()
      .then(() => {
        if (!cancelled) stop = startSync(householdId, setStatus);
      })
      .catch(() => setStatus('offline'));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [householdId, setStatus]);
}
