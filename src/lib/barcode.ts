import { guessCategory } from './normalize';
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
  };
}

export async function lookupBarcode(code: string): Promise<ParsedLine | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,generic_name,brands,categories_tags`;
  const res = await fetch(url, { headers: { 'User-Agent': 'PantryApp/0.1 (mobile)' } });
  if (!res.ok) return null;
  return productFromOpenFoodFacts(await res.json());
}
