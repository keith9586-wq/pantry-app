import type { RecipeDraft } from './customRecipe';

/**
 * Reads a recipe from a web page. Almost every recipe site publishes schema.org
 * Recipe data (for Google's recipe cards), so no AI or scraping rules are needed.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', frac12: '½', frac14: '¼', frac34: '¾', deg: '°' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

const clean = (s: unknown) =>
  typeof s === 'string'
    ? decodeEntities(s.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1')
        .trim()
    : '';

/** "PT1H30M" -> 90. Returns 0 when it can't tell. */
export function isoMinutes(d: unknown): number {
  const m = typeof d === 'string' ? d.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i) : null;
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 1440 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
}

const isRecipe = (n: unknown): n is Record<string, unknown> => {
  if (!n || typeof n !== 'object') return false;
  const t = (n as Record<string, unknown>)['@type'];
  return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'));
};

/** Searches JSON-LD (plain objects, arrays and @graph) for the first Recipe. */
function findRecipe(node: unknown): Record<string, unknown> | null {
  if (isRecipe(node)) return node;
  if (Array.isArray(node)) {
    for (const n of node) {
      const r = findRecipe(n);
      if (r) return r;
    }
  } else if (node && typeof node === 'object') {
    const g = (node as Record<string, unknown>)['@graph'];
    if (g) return findRecipe(g);
  }
  return null;
}

/** Flattens recipeInstructions: a string, a list of strings, HowToSteps, or HowToSections of steps. */
function steps(v: unknown): string[] {
  if (typeof v === 'string') {
    // An HTML block: one step per paragraph, list item or line break.
    return v
      .replace(/<\/(p|li)>|<br\s*\/?>/gi, '\n')
      .split('\n')
      .map(clean)
      .filter(Boolean);
  }
  if (Array.isArray(v)) return v.flatMap(steps);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.itemListElement) return steps(o.itemListElement);
    return steps(o.text ?? o.name);
  }
  return [];
}

function servings(v: unknown): string {
  const first = Array.isArray(v) ? v[0] : v;
  const m = String(first ?? '').match(/\d+/);
  return m ? m[0] : '';
}

/** Cleans an ingredient line for the app's parser: drops "(240 ml)" asides and checkbox junk. */
function ingredientLine(s: unknown): string {
  return clean(s)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^[▢☐□•\-*]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function recipeFromHtml(html: string): RecipeDraft | null {
  const blocks = html.match(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const json = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch {
      continue;
    }
    const r = findRecipe(data);
    if (!r) continue;
    const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : [])
      .map(ingredientLine)
      .filter(Boolean);
    if (!ingredients.length) continue;
    const minutes = isoMinutes(r.totalTime) || isoMinutes(r.cookTime) + isoMinutes(r.prepTime);
    return {
      title: clean(r.name),
      minutes: minutes ? String(minutes) : '',
      servings: servings(r.recipeYield),
      ingredients: ingredients.join('\n'),
      steps: steps(r.recipeInstructions).join('\n'),
    };
  }
  return null;
}

/** Accepts "example.com/x" too, and rejects anything that isn't a web address. */
export function normalizeUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.hostname.includes('.') ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function importRecipe(url: string): Promise<RecipeDraft> {
  const res = await fetch(url, { headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (PantryApp recipe import)' } });
  if (!res.ok) throw new Error(`That page didn't load (error ${res.status}).`);
  const draft = recipeFromHtml(await res.text());
  if (!draft) throw new Error("We couldn't find a recipe on that page. Try copying the ingredients and steps in instead.");
  return draft;
}
