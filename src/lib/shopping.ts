import { AISLE_ORDER, guessCategory, ingredientKey, keysMatch } from './normalize';
import type { Category, InventoryItem, ShoppingItem } from './types';

/**
 * Items to suggest: things bought at least twice (staples) that are now
 * missing from the inventory or marked low.
 */
export function autoSuggestions(
  inventory: InventoryItem[],
  purchaseCounts: Record<string, { name: string; count: number; category: Category }>,
  list: ShoppingItem[],
): { name: string; key: string; category: Category }[] {
  const onList = new Set(list.map((s) => s.key));
  const out: { name: string; key: string; category: Category }[] = [];
  for (const [key, info] of Object.entries(purchaseCounts)) {
    if (info.count < 2 || onList.has(key)) continue;
    const stock = inventory.filter((it) => keysMatch(it.key, key));
    const runningLow = stock.length === 0 || stock.every((it) => it.fill === 'low');
    if (runningLow) out.push({ name: info.name, key, category: info.category });
  }
  return out;
}

export function makeShoppingItem(name: string, source: ShoppingItem['source'], id: string): ShoppingItem {
  return { id, name, key: ingredientKey(name), category: guessCategory(name), checked: false, source };
}

/** Groups the list by store aisle, unchecked first within each aisle. */
export function groupByAisle(list: ShoppingItem[]): { category: Category; items: ShoppingItem[] }[] {
  return AISLE_ORDER.map((category) => ({
    category,
    items: list
      .filter((s) => s.category === category)
      .sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length > 0);
}
