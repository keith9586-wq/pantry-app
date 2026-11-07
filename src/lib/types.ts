export type StorageSpot = 'fridge' | 'freezer' | 'pantry';

export type Category =
  | 'produce'
  | 'dairy'
  | 'eggs'
  | 'meat'
  | 'seafood'
  | 'bakery'
  | 'frozen'
  | 'grains'
  | 'canned'
  | 'condiments'
  | 'snacks'
  | 'beverages'
  | 'other';

/** How much of an item is left, for things nobody wants to weigh. */
export type FillLevel = 'full' | 'half' | 'low';

export interface InventoryItem {
  id: string;
  name: string;
  /** Normalized key used to match recipes and shopping items. */
  key: string;
  category: Category;
  storage: StorageSpot;
  quantity: number;
  unit: string;
  fill: FillLevel;
  addedAt: string; // ISO timestamp
  expiresAt: string | null; // ISO timestamp
  expirySource: 'predicted' | 'user';
  price?: number;
}

/** One line read from a receipt, before the user confirms it. */
export interface ParsedLine {
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  price?: number;
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  minutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  key: string;
  category: Category;
  checked: boolean;
  source: 'auto' | 'manual' | 'recipe';
}

export interface WasteEntry {
  /** Missing on entries logged before household sync existed. */
  id?: string;
  name: string;
  price?: number;
  at: string;
  outcome: 'used' | 'tossed';
}
