import { useEffect } from 'react';
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
