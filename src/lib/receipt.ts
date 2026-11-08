import { guessCategory } from './normalize';
import type { Category, ParsedLine } from './types';

/**
 * Common receipt abbreviations. The AI parser handles far more than this;
 * this table lets the offline text parser cope with typical store shorthand.
 */
const ABBREVIATIONS: Record<string, string> = {
  WHL: 'whole',
  MLK: 'milk',
  GV: '',
  KS: '',
  ORG: 'organic',
  BNLS: 'boneless',
  SKNLS: 'skinless',
  CHKN: 'chicken',
  CHK: 'chicken',
  BRST: 'breast',
  GRND: 'ground',
  BF: 'beef',
  BNNA: 'banana',
  BNNAS: 'bananas',
  STRWBRY: 'strawberries',
  BLUBRY: 'blueberries',
  SPNCH: 'spinach',
  TOM: 'tomato',
  TOMS: 'tomatoes',
  ONN: 'onion',
  POT: 'potato',
  BRD: 'bread',
  WHT: 'wheat',
  CHS: 'cheese',
  CHDR: 'cheddar',
  SHRD: 'shredded',
  YGRT: 'yogurt',
  GRK: 'greek',
  BTR: 'butter',
  EGGS: 'eggs',
  LG: 'large',
  DZ: 'dozen',
  PNT: 'peanut',
  BTTR: 'butter',
  JCE: 'juice',
  OJ: 'orange juice',
  RCE: 'rice',
  PSTA: 'pasta',
  SCE: 'sauce',
};

const SKIP = /(SUB\s*TOTAL|TOTAL|TAX|BALANCE|CHANGE|CASH|VISA|MASTERCARD|DEBIT|CREDIT|AMEX|SAVINGS|COUPON|DISCOUNT|THANK|REWARDS|MEMBER|APPROVED|AUTH|TERMINAL|STORE\s*#|TEL|PHONE|ITEMS SOLD|BOTTLE DEPOSIT|BAG FEE)/i;

function expand(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => {
      const up = w.toUpperCase().replace(/[^A-Z]/g, '');
      return up in ABBREVIATIONS ? ABBREVIATIONS[up] : w.toLowerCase();
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Offline fallback: reads pasted receipt text line by line.
 * A line counts as an item when it ends in a price, e.g. "GV WHL MLK 1G   3.48".
 */
export function parseReceiptText(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || SKIP.test(line)) continue;
    const m = line.match(/^(.*?)[\s$]+(-?\d+\.\d{2})\s*[A-Z]{0,2}$/);
    if (!m) continue;
    const price = parseFloat(m[2]);
    if (price <= 0) continue;
    let label = m[1].replace(/\b\d{6,}\b/g, ' ').trim(); // drop UPC/SKU numbers

    let quantity = 1;
    let unit = 'each';
    const qtyPrefix = label.match(/^(\d+)\s*[@xX]\s*/);
    if (qtyPrefix) {
      quantity = parseInt(qtyPrefix[1], 10);
      label = label.slice(qtyPrefix[0].length);
    }
    const weight = label.match(/(\d+(?:\.\d+)?)\s*(LB|LBS|OZ|KG|GAL|G|CT|DZ)\b/i);
    if (weight) {
      const u = weight[2].toUpperCase();
      const n = parseFloat(weight[1]);
      if (u === 'LB' || u === 'LBS') { quantity = n; unit = 'lb'; }
      else if (u === 'OZ') { quantity = n; unit = 'oz'; }
      else if (u === 'KG') { quantity = n; unit = 'kg'; }
      else if (u === 'GAL') { quantity = n; unit = 'gal'; }
      else if (u === 'CT') { quantity = n; unit = 'each'; }
      else if (u === 'DZ') { quantity = n * 12; unit = 'each'; }
      label = label.replace(weight[0], ' ');
    }
    const name = titleCase(expand(label));
    if (name.length < 2) continue;
    out.push({ name, quantity, unit, category: guessCategory(name), price });
  }
  return out;
}

const VALID_CATEGORIES: Category[] = [
  'produce', 'dairy', 'eggs', 'meat', 'seafood', 'bakery', 'frozen',
  'grains', 'canned', 'condiments', 'snacks', 'beverages', 'other',
];

/** Validates JSON from the AI parser so a bad response can't corrupt the inventory. */
export function sanitizeParsedLines(data: unknown): ParsedLine[] {
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const out: ParsedLine[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    const quantity = typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : 1;
    const unit = typeof r.unit === 'string' && r.unit ? r.unit : 'each';
    const category = VALID_CATEGORIES.includes(r.category as Category)
      ? (r.category as Category)
      : guessCategory(name);
    const price = typeof r.price === 'number' && r.price >= 0 ? r.price : undefined;
    const brand = typeof r.brand === 'string' && r.brand.trim() ? r.brand.trim().slice(0, 40) : undefined;
    out.push({ name, quantity, unit, category, price, ...(brand ? { brand } : {}) });
  }
  return out;
}

/**
 * Sends a receipt photo to the parse-receipt server function, which calls Claude.
 * The API key lives on the server; the app only knows the function URL.
 */
export async function parseReceiptImage(base64Jpeg: string, endpoint: string, authToken?: string): Promise<ParsedLine[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ image: base64Jpeg, mediaType: 'image/jpeg' }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Receipt service returned ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return sanitizeParsedLines(await res.json());
}
