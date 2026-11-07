// RevenueCat webhook: keeps households.family_until in step with the owner's Family subscription,
// so everyone in the household gets Family features.
// In RevenueCat, set the webhook URL to this function and the Authorization header to
// REVENUECAT_WEBHOOK_AUTH. The app calls Purchases.logIn with the Supabase user id.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface RcEvent {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST' || req.headers.get('authorization') !== Deno.env.get('REVENUECAT_WEBHOOK_AUTH')) {
    return new Response('Forbidden', { status: 403 });
  }
  const { event } = (await req.json()) as { event: RcEvent };
  if (!event?.entitlement_ids?.includes('family')) return new Response('ignored');

  // Anonymous RevenueCat ids are skipped; only Supabase user ids map to households.
  const userIds = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(
    (id): id is string => !!id && UUID.test(id),
  );
  if (userIds.length === 0) return new Response('no linked user');

  const until = event.type === 'EXPIRATION' || !event.expiration_at_ms
    ? new Date().toISOString()
    : new Date(event.expiration_at_ms).toISOString();

  const { data: owned, error } = await supabase
    .from('household_members')
    .select('household_id')
    .in('user_id', userIds)
    .eq('role', 'owner');
  if (error) return new Response(error.message, { status: 500 });

  const ids = (owned ?? []).map((r) => r.household_id as string);
  if (ids.length) {
    const { error: upd } = await supabase.from('households').update({ family_until: until }).in('id', ids);
    if (upd) return new Response(upd.message, { status: 500 });
  }
  return new Response(`updated ${ids.length}`);
});
