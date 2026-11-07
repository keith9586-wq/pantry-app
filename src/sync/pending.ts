import { sanitizeParsedLines } from '../lib/receipt';
import type { ParsedLine } from '../lib/types';
import { supabase } from './client';

export interface PendingReceipt {
  id: string;
  subject: string | null;
  sender: string | null;
  receivedAt: string;
  items: ParsedLine[];
}

/** Receipts forwarded by email that nobody has confirmed yet. */
export async function listPending(householdId: string): Promise<PendingReceipt[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('pending_receipts')
    .select('id, subject, sender, received_at, items')
    .eq('household_id', householdId)
    .is('confirmed_at', null)
    .order('received_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    subject: r.subject as string | null,
    sender: r.sender as string | null,
    receivedAt: r.received_at as string,
    items: sanitizeParsedLines({ items: r.items }),
  }));
}

/** Marks a pending receipt handled, whether its items were added or it was dismissed. */
export async function markHandled(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('pending_receipts').update({ confirmed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
