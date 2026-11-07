import type { AreaPrice, PriceReport } from '../lib/priceMap';
import { supabase } from './client';
import { ensureSignedIn } from './household';

const signedIn = () => ensureSignedIn().then(() => true, () => false);

/** Shares a receipt's prices with the area map. Failures are silent: this is a bonus, never a blocker. */
export async function sharePrices(reports: PriceReport[]): Promise<void> {
  if (!supabase || reports.length === 0 || !(await signedIn())) return;
  await supabase.from('price_reports').insert(reports.slice(0, 100));
}

/** Area medians for the items you buy. Only prices with 3+ reporters are ever returned. */
export async function fetchAreaPrices(zip3: string, keys: string[]): Promise<AreaPrice[]> {
  if (!supabase || keys.length === 0 || !(await signedIn())) return [];
  const { data, error } = await supabase.from('area_prices').select('*').eq('zip3', zip3).in('key', keys.slice(0, 300));
  return error || !data ? [] : (data as AreaPrice[]);
}
