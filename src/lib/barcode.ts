import { guessCategory } from './normalize';
import type { Allergen } from './diet';
import type { ParsedLine } from './types';

/**
 * Maps an Open Food Facts product response to a pantry line.
 * Returns null when the product is unknown so the app can ask for a name.
 */
export function productFromOpenFoodFacts(json: unknown): ParsedLine | null {
  const r = json as { status?: number; product?: Record<string, unknown> };
  if (!r || r.status !== 1 || !r.product) return null;
  const p = r.product;
  const name = [p.product_name, p.generic_name].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  if (!name) return null;
  const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : '';
  const tags = Array.isArray(p.categories_tags) ? (p.categories_tags as string[]).join(' ').replace(/en:|-/g, ' ') : '';
  let category = guessCategory(name);
  if (category === 'other' && tags) category = guessCategory(tags);
  return {
    name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name.trim()} (${brand})` : name.trim(),
    quantity: 1,
    unit: 'each',
    category,
    ...(brand ? { brand } : {}),
  };
}

/** What the label says, from Open Food Facts. Empty when the product has no data. */
export interface ProductFacts {
  allergens: Allergen[];
  /** "May contain" warnings. */
  traces: Allergen[];
  vegan: boolean | null;
  vegetarian: boolean | null;
  glutenFree: boolean;
}

const OFF_ALLERGEN: Record<string, Allergen> = {
  'en:milk': 'dairy',
  'en:eggs': 'eggs',
  'en:gluten': 'gluten',
  'en:peanuts': 'peanuts',
  'en:nuts': 'treeNuts',
  'en:fish': 'fish',
  'en:crustaceans': 'shellfish',
  'en:molluscs': 'shellfish',
  'en:soybeans': 'soy',
  'en:sesame-seeds': 'sesame',
};

const tagList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const allergensFrom = (v: unknown) => [...new Set(tagList(v).map((t) => OFF_ALLERGEN[t]).filter(Boolean))];

export function factsFromOpenFoodFacts(json: unknown): ProductFacts {
  const p = ((json as { product?: Record<string, unknown> })?.product ?? {}) as Record<string, unknown>;
  const analysis = tagList(p.ingredients_analysis_tags);
  const labels = tagList(p.labels_tags);
  const allergens = allergensFrom(p.allergens_tags);
  const flag = (yes: string, no: string) => (analysis.includes(no) ? false : analysis.includes(yes) || labels.includes(yes) ? true : null);
  return {
    allergens,
    traces: allergensFrom(p.traces_tags).filter((a) => !allergens.includes(a)),
    vegan: flag('en:vegan', 'en:non-vegan'),
    vegetarian: flag('en:vegetarian', 'en:non-vegetarian'),
    glutenFree: labels.includes('en:gluten-free') || labels.includes('en:no-gluten'),
  };
}

const FIELDS = 'product_name,generic_name,brands,categories_tags,allergens_tags,traces_tags,labels_tags,ingredients_analysis_tags';

export async function lookupBarcode(code: string): Promise<{ line: ParsedLine; facts: ProductFacts } | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PantryApp/0.1 (mobile)' } });
  if (!res.ok) return null;
  const json = await res.json();
  const line = productFromOpenFoodFacts(json);
  return line ? { line, facts: factsFromOpenFoodFacts(json) } : null;
}
