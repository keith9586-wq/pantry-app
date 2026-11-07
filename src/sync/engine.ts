import type { InventoryItem, ShoppingItem, WasteEntry } from '../lib/types';
import { newId, useStore } from '../store/useStore';
import { supabase } from './client';
import { diffById, unionById } from './diff';
import {
  eventToRow,
  itemToRow,
  rowToEvent,
  rowToItem,
  rowToShopping,
  shoppingToRow,
  type EventRow,
  type ItemRow,
  type ShoppingRow,
} from './rows';

type Event = WasteEntry & { id: string };
interface Synced {
  items: InventoryItem[];
  shopping: ShoppingItem[];
  log: Event[];
}

const LOG_LIMIT = 500;

/** Gives older history entries an id so they can be stored in the household. */
const withIds = (log: WasteEntry[]): Event[] => log.map((e) => (e.id ? (e as Event) : { ...e, id: newId() }));

async function pull(householdId: string): Promise<Synced> {
  const sb = supabase!;
  const [items, shopping, events] = await Promise.all([
    sb.from('items').select('*').eq('household_id', householdId),
    sb.from('shopping_items').select('*').eq('household_id', householdId),
    sb.from('item_events').select('*').eq('household_id', householdId).order('at', { ascending: false }).limit(LOG_LIMIT),
  ]);
  const err = items.error ?? shopping.error ?? events.error;
  if (err) throw new Error(err.message);
  return {
    items: (items.data as ItemRow[]).map(rowToItem),
    shopping: (shopping.data as ShoppingRow[]).map(rowToShopping),
    log: (events.data as EventRow[]).map(rowToEvent) as Event[],
  };
}

async function push(householdId: string, before: Synced, after: Synced): Promise<void> {
  const sb = supabase!;
  const items = diffById(before.items, after.items);
  const shopping = diffById(before.shopping, after.shopping);
  const log = diffById(before.log, after.log);
  // History is trimmed to the newest entries on the phone; only delete events that were
  // removed on purpose (an undo), not ones that simply aged out of the local list.
  const oldestKept = after.log.at(-1)?.at ?? '';
  const logDeletes = log.deletes.filter((id) => (before.log.find((e) => e.id === id)?.at ?? '') >= oldestKept);

  const ops = [];
  if (items.upserts.length) ops.push(sb.from('items').upsert(items.upserts.map((i) => itemToRow(i, householdId))));
  if (items.deletes.length) ops.push(sb.from('items').delete().in('id', items.deletes));
  if (shopping.upserts.length) ops.push(sb.from('shopping_items').upsert(shopping.upserts.map((s) => shoppingToRow(s, householdId))));
  if (shopping.deletes.length) ops.push(sb.from('shopping_items').delete().in('id', shopping.deletes));
  if (log.upserts.length) ops.push(sb.from('item_events').upsert(log.upserts.map((e) => eventToRow(e, householdId))));
  if (logDeletes.length) ops.push(sb.from('item_events').delete().in('id', logDeletes));
  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export type SyncStatus = 'idle' | 'syncing' | 'live' | 'offline';

/**
 * Keeps the phone's store and the household's tables in step.
 * Local edits are pushed shortly after they happen; edits from other members arrive
 * over realtime and replace the local copy. Last write wins.
 * Returns a function that stops syncing.
 */
export function startSync(householdId: string, onStatus: (s: SyncStatus) => void = () => {}): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  let stopped = false;
  let synced: Synced | null = null;
  let applying = false;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let pullTimer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();

  const current = (): Synced => {
    const s = useStore.getState();
    return { items: s.items, shopping: s.shopping, log: withIds(s.log) };
  };

  const apply = (data: Synced) => {
    applying = true;
    useStore.getState().applyRemote(data);
    applying = false;
    synced = data;
  };

  // Serialize pushes and pulls so a pull never overwrites edits that are still on their way up.
  const enqueue = (job: () => Promise<void>) => {
    chain = chain.then(job).catch(() => onStatus('offline'));
    return chain;
  };

  const flush = () =>
    enqueue(async () => {
      if (stopped || !synced) return;
      const next = current();
      await push(householdId, synced, next);
      synced = next;
      onStatus('live');
    });

  const refresh = () =>
    enqueue(async () => {
      if (stopped || !synced) return;
      // Send any local edit that hasn't gone up yet, so the pull can't erase it.
      const local = current();
      await push(householdId, synced, local);
      synced = local;
      apply(await pull(householdId));
      onStatus('live');
    });

  // First run on this device: merge what is already on the phone into the household.
  enqueue(async () => {
    onStatus('syncing');
    const server = await pull(householdId);
    const local = current();
    const merged: Synced = {
      items: unionById(server.items, local.items),
      shopping: unionById(server.shopping, local.shopping),
      log: unionById(server.log, local.log)
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, LOG_LIMIT),
    };
    await push(householdId, server, merged);
    if (!stopped) apply(merged);
    onStatus('live');
  });

  const unsubscribeStore = useStore.subscribe((state, prev) => {
    if (applying || stopped) return;
    if (state.items === prev.items && state.shopping === prev.shopping && state.log === prev.log) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, 400);
  });

  const scheduleRefresh = () => {
    if (pullTimer) clearTimeout(pullTimer);
    pullTimer = setTimeout(refresh, 300);
  };
  const filter = `household_id=eq.${householdId}`;
  const channel = sb
    .channel(`household-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'item_events', filter }, scheduleRefresh)
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onStatus('offline');
    });

  return () => {
    stopped = true;
    if (pushTimer) clearTimeout(pushTimer);
    if (pullTimer) clearTimeout(pullTimer);
    unsubscribeStore();
    sb.removeChannel(channel);
    onStatus('idle');
  };
}
