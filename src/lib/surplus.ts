import type { Category, InventoryItem } from './types';

const DAY = 24 * 60 * 60 * 1000;

/** Never offered to strangers: raw meat and fish. Home-cooked leftovers are left out too. */
export const NOT_FOR_STRANGERS: Category[] = ['meat', 'seafood'];

export interface Offer {
  id: string;
  owner: string;
  zip3: string;
  giver: string;
  name: string;
  amount: string;
  category: Category;
  good_until: string; // YYYY-MM-DD
  pickup_area: string;
  note: string;
  status: 'open' | 'promised' | 'gone' | 'withdrawn';
  created_at: string;
}

export interface Claim {
  id: string;
  offer_id: string;
  claimer: string;
  claimer_name: string;
  message: string;
  accepted: boolean;
  created_at: string;
}

/** First three digits of a US ZIP: the area offers are shown in. */
export function areaOf(zip: string): string | null {
  const m = zip.trim().match(/^(\d{3})\d{2}(-\d{4})?$/);
  return m ? m[1] : null;
}

const ymd = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/** Why an item can't be posted nearby, or null when it can. Friends can still be offered anything. */
export function nearbyBlock(item: InventoryItem, now = new Date()): string | null {
  if (item.key.includes(':')) return "Home-cooked food can only be offered to friends.";
  if (NOT_FOR_STRANGERS.includes(item.category)) return 'Raw meat and fish can only be offered to friends.';
  if (item.expiresAt && new Date(item.expiresAt).getTime() < now.getTime()) return "It's past its date.";
  return null;
}

export function offerAmount(item: InventoryItem): string {
  if (item.unit === 'each') return item.quantity === 1 ? '' : String(item.quantity);
  return `${item.quantity} ${item.unit}`;
}

/** Good until its use-by date, or 3 days from now when we don't know. Never in the past. */
export function goodUntil(item: InventoryItem, now = new Date()): string {
  const fallback = new Date(now.getTime() + 3 * DAY);
  const d = item.expiresAt ? new Date(item.expiresAt) : fallback;
  return ymd(d < now ? now : d);
}

export function goodUntilLabel(date: string, now = new Date()): string {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const diff = Math.round((day.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / DAY);
  if (diff <= 0) return 'good today';
  if (diff === 1) return 'good until tomorrow';
  return `good until ${day.toLocaleDateString(undefined, { weekday: 'long' })}`;
}

/** The message for friends: sent from the phone's own share sheet, nothing goes through our servers. */
export function shareText(item: InventoryItem, now = new Date()): string {
  const amount = offerAmount(item);
  return `I've got ${item.name.toLowerCase()}${amount ? ` (${amount})` : ''} I won't use in time, ${goodUntilLabel(goodUntil(item, now), now)}. Want it? Free.`;
}

/** Newest first, soonest to spoil first within a day: the ones that most need a taker. */
export function sortOffers(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => a.good_until.localeCompare(b.good_until) || b.created_at.localeCompare(a.created_at));
}
