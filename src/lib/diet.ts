import { ingredientKey } from './normalize';
import type { ProductFacts } from './barcode';
import type { Recipe, RecipeIngredient } from './types';

export type Diet = 'vegetarian' | 'vegan' | 'pescatarian' | 'glutenFree' | 'dairyFree';
export type Allergen = 'peanuts' | 'treeNuts' | 'dairy' | 'eggs' | 'gluten' | 'fish' | 'shellfish' | 'soy' | 'sesame';

export interface DietProfile {
  diets: Diet[];
  allergies: Allergen[];
  /** Ingredients you just don't want, e.g. "mushroom". Matched by normalized name. */
  dislikes: string[];
}

export const EMPTY_PROFILE: DietProfile = { diets: [], allergies: [], dislikes: [] };

export const DIET_LABEL: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  glutenFree: 'Gluten-free',
  dairyFree: 'Dairy-free',
};

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  peanuts: 'Peanuts',
  treeNuts: 'Tree nuts',
  dairy: 'Dairy',
  eggs: 'Eggs',
  gluten: 'Gluten',
  fish: 'Fish',
  shellfish: 'Shellfish',
  soy: 'Soy',
  sesame: 'Sesame',
};

type Tag = 'meat' | 'fish' | 'shellfish' | 'dairy' | 'eggs' | 'gluten' | 'peanuts' | 'treeNuts' | 'soy' | 'sesame' | 'honey';

/** Words that put an ingredient in a group. Checked against whole words of the normalized name. */
const TAG_WORDS: Record<Tag, string[]> = {
  meat: ['beef', 'pork', 'bacon', 'ham', 'sausage', 'chicken', 'turkey', 'lamb', 'steak', 'prosciutto', 'salami', 'pepperoni', 'chorizo', 'veal', 'duck', 'meatball', 'hot dog', 'gelatin'],
  fish: ['salmon', 'tuna', 'cod', 'tilapia', 'trout', 'sardine', 'anchovy', 'halibut', 'fish', 'mackerel'],
  shellfish: ['shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster'],
  dairy: ['milk', 'cheese', 'cheddar', 'parmesan', 'mozzarella', 'feta', 'butter', 'cream', 'yogurt', 'sour cream', 'ricotta', 'ghee', 'whey'],
  eggs: ['egg', 'mayonnaise', 'mayo'],
  gluten: ['flour', 'bread', 'pasta', 'spaghetti', 'noodle', 'tortilla', 'bun', 'bagel', 'cracker', 'couscous', 'barley', 'wheat', 'granola', 'breadcrumb', 'soy sauce', 'pizza dough', 'cereal'],
  peanuts: ['peanut'],
  treeNuts: ['almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia'],
  soy: ['soy', 'tofu', 'edamame', 'tempeh', 'miso'],
  sesame: ['sesame', 'tahini'],
  honey: ['honey'],
};

/** Exceptions that look like a group but aren't, e.g. coconut milk is not dairy. */
const NOT: Partial<Record<Tag, string[]>> = {
  dairy: ['coconut milk', 'almond milk', 'oat milk', 'soy milk', 'peanut butter', 'almond butter', 'cream of tartar', 'vegan'],
  gluten: ['gluten free', 'corn tortilla', 'rice noodle', 'rice flour'],
  eggs: ['vegan'],
};

function hasWord(name: string, word: string) {
  return new RegExp(`(^|\\s)${word}(s|es)?(\\s|$)`).test(name);
}

export function ingredientTags(name: string): Set<Tag> {
  const key = ingredientKey(name);
  const n = name.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const tags = new Set<Tag>();
  for (const [tag, words] of Object.entries(TAG_WORDS) as [Tag, string[]][]) {
    if ((NOT[tag] ?? []).some((x) => n.includes(x))) continue;
    if (words.some((w) => hasWord(key, w) || hasWord(n, w))) tags.add(tag);
  }
  return tags;
}

const DIET_BLOCKS: Record<Diet, Tag[]> = {
  vegetarian: ['meat', 'fish', 'shellfish'],
  vegan: ['meat', 'fish', 'shellfish', 'dairy', 'eggs', 'honey'],
  pescatarian: ['meat'],
  glutenFree: ['gluten'],
  dairyFree: ['dairy'],
};

export interface Conflict {
  ingredient: RecipeIngredient;
  /** e.g. "Vegetarian", "Peanuts allergy", "You don't like it". */
  reason: string;
}

/** Why an ingredient doesn't fit the profile, or null if it does. Allergies are listed first. */
export function ingredientConflict(ing: RecipeIngredient, profile: DietProfile): string | null {
  const tags = ingredientTags(ing.name);
  for (const a of profile.allergies) if (tags.has(a)) return `${ALLERGEN_LABEL[a]} allergy`;
  for (const d of profile.diets) if (DIET_BLOCKS[d].some((t) => tags.has(t))) return DIET_LABEL[d];
  const key = ingredientKey(ing.name);
  if (profile.dislikes.some((x) => ingredientKey(x) === key || hasWord(key, ingredientKey(x)))) return "You don't like it";
  return null;
}

export interface RecipeFit {
  /** Required ingredients that break the profile. Any of these hides the recipe. */
  blocking: Conflict[];
  /** Optional ingredients to leave out. */
  skip: Conflict[];
}

export function recipeFit(recipe: Recipe, profile: DietProfile): RecipeFit {
  const blocking: Conflict[] = [];
  const skip: Conflict[] = [];
  for (const ing of recipe.ingredients) {
    const reason = ingredientConflict(ing, profile);
    if (reason) (ing.optional ? skip : blocking).push({ ingredient: ing, reason });
  }
  return { blocking, skip };
}

export function fitsProfile(recipe: Recipe, profile: DietProfile) {
  return recipeFit(recipe, profile).blocking.length === 0;
}

export function isEmptyProfile(p: DietProfile) {
  return p.diets.length === 0 && p.allergies.length === 0 && p.dislikes.length === 0;
}

/** Splits a typed list like "mushrooms, olives" into clean names. */
export function parseDislikes(text: string): string[] {
  return [...new Set(text.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

export interface ProductWarning {
  text: string;
  /** Allergies are serious; "may contain" and diet notes are cautions. */
  level: 'danger' | 'caution';
}

/**
 * Checks a scanned product's label against the profile.
 * Falls back to the product name when the label lists no allergens.
 */
export function productWarnings(name: string, facts: ProductFacts, profile: DietProfile): ProductWarning[] {
  const out: ProductWarning[] = [];
  const fromName = ingredientTags(name);
  for (const a of profile.allergies) {
    if (facts.allergens.includes(a) || fromName.has(a)) out.push({ text: `Contains ${ALLERGEN_LABEL[a].toLowerCase()}`, level: 'danger' });
    else if (facts.traces.includes(a)) out.push({ text: `May contain ${ALLERGEN_LABEL[a].toLowerCase()}`, level: 'caution' });
  }
  const has = (a: Allergen) => facts.allergens.includes(a) || fromName.has(a);
  for (const d of profile.diets) {
    const bad =
      d === 'vegan'
        ? facts.vegan === false || DIET_BLOCKS.vegan.some((t) => fromName.has(t)) || has('dairy') || has('eggs')
        : d === 'vegetarian'
          ? facts.vegetarian === false || DIET_BLOCKS.vegetarian.some((t) => fromName.has(t))
          : d === 'pescatarian'
            ? fromName.has('meat')
            : d === 'glutenFree'
              ? !facts.glutenFree && has('gluten')
              : has('dairy');
    if (bad) out.push({ text: `Not ${DIET_LABEL[d].toLowerCase()}`, level: 'caution' });
  }
  // Allergies first.
  return out.sort((x, y) => (x.level === y.level ? 0 : x.level === 'danger' ? -1 : 1));
}
