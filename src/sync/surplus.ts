import type { Claim, Offer } from '../lib/surplus';
import { supabase } from './client';
import { ensureSignedIn } from './household';

function sb() {
  if (!supabase) throw new Error('Sharing food nearby needs the app backend.');
  return supabase;
}

const check = <T>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data as T;
};

/** Open offers in your area, plus anything of yours or that you asked for. */
export async function listOffers(zip3: string): Promise<{ me: string; offers: Offer[] }> {
  const me = await ensureSignedIn();
  const rows = check(await sb().from('surplus_offers').select('*').or(`zip3.eq.${zip3},owner.eq.${me}`).order('good_until'));
  return { me, offers: (rows ?? []) as Offer[] };
}

export async function postOffer(offer: Omit<Offer, 'id' | 'owner' | 'status' | 'created_at'>, contact: string): Promise<Offer> {
  await ensureSignedIn();
  const row = check(await sb().from('surplus_offers').insert(offer).select().single()) as Offer;
  check(await sb().from('surplus_contacts').insert({ offer_id: row.id, contact }));
  return row;
}

export async function setOfferStatus(id: string, status: Offer['status']): Promise<void> {
  check(await sb().from('surplus_offers').update({ status }).eq('id', id));
}

/** Claims on your offers, and your own claims on others'. RLS returns only those two kinds. */
export async function listClaims(): Promise<Claim[]> {
  await ensureSignedIn();
  return (check(await sb().from('surplus_claims').select('*').order('created_at')) ?? []) as Claim[];
}

export async function askFor(offerId: string, name: string, message: string): Promise<void> {
  await ensureSignedIn();
  check(await sb().from('surplus_claims').insert({ offer_id: offerId, claimer_name: name, message }));
}

export async function acceptClaim(claimId: string): Promise<void> {
  check(await sb().rpc('accept_claim', { claim: claimId }));
}

/** How to reach the giver. Only returned once they accepted your request. */
export async function giverContact(offerId: string): Promise<string | null> {
  const rows = check(await sb().from('surplus_contacts').select('contact').eq('offer_id', offerId)) as { contact: string }[] | null;
  return rows?.[0]?.contact ?? null;
}

export async function reportOffer(offerId: string): Promise<void> {
  check(await sb().rpc('report_offer', { offer: offerId }));
}
