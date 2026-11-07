import { supabase } from './client';

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  inbox_code: string;
}

function client() {
  if (!supabase) throw new Error('Sharing needs a backend. Add the Supabase settings to .env (see README).');
  return supabase;
}

/**
 * Makes sure there is a signed-in user. Starts with an anonymous account so nobody
 * hits a sign-up wall; it can be upgraded to email sign-in later without losing data.
 */
export async function ensureSignedIn(): Promise<string> {
  const sb = client();
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const { data: signedIn, error } = await sb.auth.signInAnonymously();
  if (error || !signedIn.user) throw new Error(error?.message ?? 'Could not sign in');
  return signedIn.user.id;
}

export async function createHousehold(name: string): Promise<Household> {
  await ensureSignedIn();
  const { data, error } = await client().rpc('create_household', { household_name: name || 'Home' });
  if (error) throw new Error(error.message);
  return data as Household;
}

export async function joinHousehold(code: string): Promise<Household> {
  await ensureSignedIn();
  const { data, error } = await client().rpc('join_household', { code: code.trim().toLowerCase() });
  if (error) throw new Error(error.message.includes('not found') ? 'That invite code was not found.' : error.message);
  return data as Household;
}

export async function getHousehold(id: string): Promise<{ household: Household; members: number } | null> {
  const sb = client();
  const [{ data: household }, { count }] = await Promise.all([
    sb.from('households').select('id, name, invite_code, inbox_code').eq('id', id).maybeSingle(),
    sb.from('household_members').select('user_id', { count: 'exact', head: true }).eq('household_id', id),
  ]);
  return household ? { household: household as Household, members: count ?? 1 } : null;
}

export async function leaveHousehold(id: string): Promise<void> {
  const sb = client();
  const userId = await ensureSignedIn();
  const { error } = await sb.from('household_members').delete().eq('household_id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export function inboxAddress(inboxCode: string): string | null {
  const domain = process.env.EXPO_PUBLIC_RECEIPT_EMAIL_DOMAIN;
  return domain ? `r-${inboxCode}@${domain}` : null;
}
