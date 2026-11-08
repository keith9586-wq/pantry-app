import type { InventoryItem } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** Recalls older than this are not shown; most food on hand was bought more recently. */
export const RECALL_WINDOW_DAYS = 60;

export interface Recall {
  id: string;
  source: 'fda' | 'usda';
  product: string;
  firm: string;
  reason: string;
  /** FDA "Class I" or USDA "High"; the most serious ones. */
  serious: boolean;
  date: string; // ISO
  url: string;
}

export interface RecallMatch {
  recall: Recall;
  item: InventoryItem;
  /** brand: the brand on your item is named in the recall. name: only the food matches, so check the label. */
  strength: 'brand' | 'name';
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** "20261105" or "2026-11-05" → ISO date, or '' when unreadable. */
function isoDate(v: unknown): string {
  const s = str(v);
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString() : '';
}

/** openFDA food enforcement reports: https://open.fda.gov/apis/food/enforcement/ */
export function parseFdaRecalls(json: unknown): Recall[] {
  const results = (json as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  const out: Recall[] = [];
  for (const r of results as Record<string, unknown>[]) {
    const id = str(r?.recall_number);
    const date = isoDate(r?.recall_initiation_date) || isoDate(r?.report_date);
    const product = str(r?.product_description);
    if (!id || !date || !product) continue;
    if (/terminated|completed/i.test(str(r.status))) continue;
    out.push({
      id: `fda:${id}`,
      source: 'fda',
      product: product.slice(0, 400),
      firm: str(r.recalling_firm),
      reason: str(r.reason_for_recall).slice(0, 400),
      serious: str(r.classification) === 'Class I',
      date,
      url: 'https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts',
    });
  }
  return out;
}

/** USDA FSIS recall API (meat, poultry, egg products): https://www.fsis.usda.gov/science-data/developer-resources/recall-api */
export function parseFsisRecalls(json: unknown): Recall[] {
  if (!Array.isArray(json)) return [];
  const out: Recall[] = [];
  for (const r of json as Record<string, unknown>[]) {
    const id = str(r?.field_recall_number);
    const date = isoDate(r?.field_recall_date);
    const product = str(r?.field_product_items) || str(r?.field_title);
    if (!id || !date || !product) continue;
    if (str(r.field_archive_recall) === 'True') continue;
    out.push({
      id: `usda:${id}`,
      source: 'usda',
      product: `${str(r.field_title)} ${str(r.field_product_items)}`.trim().slice(0, 400),
      firm: str(r.field_establishment),
      reason: str(r.field_recall_reason) || str(r.field_summary).replace(/<[^>]+>/g, ' ').slice(0, 400),
      serious: /high/i.test(str(r.field_risk_level)),
      date,
      url: 'https://www.fsis.usda.gov/recalls',
    });
  }
  return out;
}

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
const hasWord = (text: string, word: string) =>
  text.includes(` ${word} `) || text.includes(` ${word}s `) || text.includes(` ${word}es `);

/** Words that say what the food is; leftovers and very short keys can't be matched safely. */
function foodWords(item: InventoryItem): string[] {
  // Leftovers have keys like "leftover:<id>" and are never matched.
  if (item.key.includes(':')) return [];
  return norm(item.key).trim().split(' ').filter((w) => w.length >= 3);
}

/**
 * Recalls that may cover food you have. When the item has a brand, the recall must name it;
 * without one, a recall for the same food is shown as "check the label".
 */
export function matchRecalls(
  recalls: Recall[],
  items: InventoryItem[],
  dismissed: string[] = [],
  now = new Date(),
): RecallMatch[] {
  const skip = new Set(dismissed);
  const cutoff = now.getTime() - RECALL_WINDOW_DAYS * DAY;
  const out: RecallMatch[] = [];
  for (const recall of recalls) {
    if (new Date(recall.date).getTime() < cutoff) continue;
    const text = norm(`${recall.product} ${recall.firm}`);
    for (const item of items) {
      if (skip.has(`${recall.id}|${item.id}`)) continue;
      const words = foodWords(item);
      if (words.length === 0 || !words.every((w) => hasWord(text, w))) continue;
      if (item.brand) {
        const brand = norm(item.brand).trim();
        if (brand && text.includes(` ${brand} `)) out.push({ recall, item, strength: 'brand' });
        continue;
      }
      out.push({ recall, item, strength: 'name' });
    }
  }
  return out.sort(
    (a, b) =>
      Number(b.strength === 'brand') - Number(a.strength === 'brand') ||
      Number(b.recall.serious) - Number(a.recall.serious) ||
      b.recall.date.localeCompare(a.recall.date),
  );
}

export const matchKey = (m: RecallMatch) => `${m.recall.id}|${m.item.id}`;

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

/** Fetches recent FDA and USDA food recalls. Either feed failing just leaves its part out. */
export async function fetchRecalls(now = new Date()): Promise<Recall[]> {
  const since = new Date(now.getTime() - RECALL_WINDOW_DAYS * DAY);
  const fda = fetch(
    `https://api.fda.gov/food/enforcement.json?search=report_date:[${ymd(since)}+TO+${ymd(now)}]&sort=report_date:desc&limit=1000`,
  )
    .then((r) => (r.ok ? r.json() : null))
    .then(parseFdaRecalls)
    .catch(() => [] as Recall[]);
  const usda = fetch('https://www.fsis.usda.gov/fsis/api/recall/v/1')
    .then((r) => (r.ok ? r.json() : null))
    .then(parseFsisRecalls)
    .catch(() => [] as Recall[]);
  const [a, b] = await Promise.all([fda, usda]);
  return [...a, ...b];
}
