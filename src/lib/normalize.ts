import type { Category, StorageSpot } from './types';

const SYNONYMS: Record<string, string> = {
  scallion: 'green onion',
  'spring onion': 'green onion',
  cilantro: 'coriander',
  'chicken breasts': 'chicken breast',
  'boneless chicken breast': 'chicken breast',
  'chicken thighs': 'chicken thigh',
  'hamburger': 'ground beef',
  'minced beef': 'ground beef',
  'whole milk': 'milk',
  '2% milk': 'milk',
  'skim milk': 'milk',
  'large eggs': 'egg',
  'eggs': 'egg',
  'cheddar cheese': 'cheddar',
  'shredded cheddar': 'cheddar',
  'baby spinach': 'spinach',
  'roma tomato': 'tomato',
  'cherry tomatoes': 'tomato',
  'yellow onion': 'onion',
  'red onion': 'onion',
  'russet potato': 'potato',
  'white rice': 'rice',
  'jasmine rice': 'rice',
  'spaghetti': 'pasta',
  'penne': 'pasta',
  'unsalted butter': 'butter',
  'salted butter': 'butter',
  'greek yogurt': 'yogurt',
  'plain yogurt': 'yogurt',
  'sandwich bread': 'bread',
  'whole wheat bread': 'bread',
  'garlic cloves': 'garlic',
  'flour tortillas': 'tortilla',
  'corn tortillas': 'tortilla',
};

/** Simple English singularization, enough for grocery nouns. */
function singular(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (/(ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/** Turns "Baby Spinach 5oz" or "Large Eggs" into a stable matching key. */
export function ingredientKey(name: string): string {
  let s = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s*(oz|lb|lbs|g|kg|ml|l|ct|pk|gal|qt)\b/g, ' ')
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (SYNONYMS[s]) return SYNONYMS[s];
  const words = s.split(' ').map(singular);
  s = words.join(' ');
  if (SYNONYMS[s]) return SYNONYMS[s];
  // Try dropping leading descriptors ("organic", "fresh", "large").
  const stripped = words
    .filter((w) => !['organic', 'fresh', 'large', 'small', 'medium', 'boneless', 'skinless', 'frozen'].includes(w))
    .join(' ');
  return SYNONYMS[stripped] ?? stripped;
}

/** True when a pantry item can stand in for a recipe ingredient. */
export function keysMatch(pantryKey: string, recipeKey: string): boolean {
  if (pantryKey === recipeKey) return true;
  // "chicken breast" satisfies "chicken"; "cheddar" does not satisfy "cheese" (too loose).
  const p = ` ${pantryKey} `;
  return p.includes(` ${recipeKey} `);
}

const CATEGORY_WORDS: [Category, string[]][] = [
  // Produce that would otherwise be caught by a later, broader word ("pepper", "bean").
  ['produce', ['bell pepper', 'jalapeno', 'green bean', 'fresh herb']],
  ['eggs', ['egg']],
  ['dairy', ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'yogurt', 'butter', 'cream', 'sour cream', 'cottage']],
  ['seafood', ['salmon', 'shrimp', 'tuna steak', 'cod', 'tilapia', 'fish']],
  ['meat', ['chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham', 'steak', 'lamb']],
  ['bakery', ['bread', 'bagel', 'bun', 'tortilla', 'muffin', 'croissant', 'roll']],
  ['frozen', ['frozen', 'ice cream', 'pizza']],
  ['grains', ['rice', 'pasta', 'oat', 'flour', 'quinoa', 'cereal', 'noodle']],
  ['canned', ['can ', 'canned', 'bean', 'tuna', 'soup', 'tomato sauce', 'broth', 'stock']],
  ['condiments', ['ketchup', 'mustard', 'mayo', 'sauce', 'oil', 'vinegar', 'salt', 'pepper', 'spice', 'honey', 'syrup', 'dressing']],
  ['snacks', ['chip', 'cracker', 'cookie', 'pretzel', 'popcorn', 'bar']],
  ['beverages', ['juice', 'soda', 'water', 'coffee', 'tea', 'beer', 'wine']],
  ['produce', ['apple', 'banana', 'berry', 'strawberr', 'blueberr', 'grape', 'orange', 'lemon', 'lime', 'avocado', 'tomato', 'onion', 'garlic', 'potato', 'carrot', 'celery', 'lettuce', 'spinach', 'kale', 'broccoli', 'pepper', 'cucumber', 'zucchini', 'mushroom', 'herb', 'coriander', 'basil', 'green onion', 'cabbage', 'pear', 'peach', 'mango']],
];

export function guessCategory(name: string): Category {
  const n = ` ${name.toLowerCase()} `;
  for (const [cat, words] of CATEGORY_WORDS) {
    if (words.some((w) => n.includes(w))) return cat;
  }
  return 'other';
}

export function defaultStorage(category: Category, name = ''): StorageSpot {
  const n = name.toLowerCase();
  if (category === 'frozen') return 'freezer';
  if (['dairy', 'eggs', 'meat', 'seafood'].includes(category)) return 'fridge';
  if (category === 'produce') {
    // Counter or pantry produce.
    if (/(banana|potato|onion|garlic|avocado|apple|tomato|squash)/.test(n)) return 'pantry';
    return 'fridge';
  }
  return 'pantry';
}

/** Store aisle order used to sort the shopping list. */
export const AISLE_ORDER: Category[] = [
  'produce',
  'bakery',
  'meat',
  'seafood',
  'dairy',
  'eggs',
  'frozen',
  'grains',
  'canned',
  'condiments',
  'snacks',
  'beverages',
  'other',
];

export const CATEGORY_LABEL: Record<Category, string> = {
  produce: 'Produce',
  dairy: 'Dairy',
  eggs: 'Eggs',
  meat: 'Meat',
  seafood: 'Seafood',
  bakery: 'Bakery',
  frozen: 'Frozen',
  grains: 'Grains and pasta',
  canned: 'Canned goods',
  condiments: 'Condiments and spices',
  snacks: 'Snacks',
  beverages: 'Beverages',
  other: 'Other',
};
