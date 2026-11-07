import { supabase } from './client';
import { ensureSignedIn } from './household';

function client() {
  if (!supabase) throw new Error('Accounts need the Supabase settings in .env.');
  return supabase;
}

export async function getAccount(): Promise<{ email: string | null; anonymous: boolean }> {
  const { data } = await client().auth.getUser();
  const u = data.user;
  return { email: u?.email ?? null, anonymous: !u || !u.email };
}

/** Step 1 of saving an anonymous account: emails a 6-digit code. */
export async function startSaveEmail(email: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await client().auth.updateUser({ email: email.trim() });
  if (error) throw new Error(error.message);
}

export async function confirmSaveEmail(email: string, code: string): Promise<void> {
  const { error } = await client().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email_change' });
  if (error) throw new Error(error.message);
}

/** Sign in on a new phone. Only existing accounts; new people start anonymously. */
export async function startSignIn(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
  if (error) throw new Error(error.message);
}

/** Verifies the code and returns the user's household, if they belong to one. */
export async function confirmSignIn(email: string, code: string): Promise<{ userId: string; householdId: string | null }> {
  const sb = client();
  const { data, error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error || !data.user) throw new Error(error?.message ?? 'Could not sign in');
  const { data: m } = await sb
    .from('household_members')
    .select('household_id')
    .eq('user_id', data.user.id)
    .limit(1)
    .maybeSingle();
  return { userId: data.user.id, householdId: (m?.household_id as string | undefined) ?? null };
}
