import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { predictExpiry } from '../lib/expiry';
import { defaultStorage, guessCategory, ingredientKey } from '../lib/normalize';
import { cookRecipe } from '../lib/recipes';
import { autoSuggestions, makeShoppingItem } from '../lib/shopping';
import type {
  Category,
  FillLevel,
  InventoryItem,
  ParsedLine,
  Recipe,
  ShoppingItem,
  StorageSpot,
  WasteEntry,
} from '../lib/types';

import { uuid } from '../lib/id';

export const newId = uuid;

type PurchaseCounts = Record<string, { name: string; count: number; category: Category }>;

export interface NewItemInput {
  name: string;
  quantity?: number;
  unit?: string;
  category?: Category;
  storage?: StorageSpot;
  price?: number;
  expiresAt?: string | null;
}

interface Snapshot {
  items: InventoryItem[];
  shopping: ShoppingItem[];
  log: WasteEntry[];
  purchaseCounts: PurchaseCounts;
}

interface State extends Snapshot {
  /** Dates of receipt photo scans, for the free plan's monthly limit. */
  scanLog: string[];
  recordScan: () => void;
  /** Set once the user creates or joins a household; turns on cloud sync. */
  householdId: string | null;
  setHousehold: (id: string | null) => void;
  /** Replaces local data with the household's copy. Not undoable and not echoed back. */
  applyRemote: (data: Partial<Pick<Snapshot, 'items' | 'shopping' | 'log'>>) => void;

  /** The last change that can be undone, kept in memory only. */
  lastAction: { label: string; before: Snapshot } | null;
  undo: () => void;
  clearUndo: () => void;

  addItems: (inputs: NewItemInput[], purchasedAt?: Date) => void;
  addParsed: (lines: ParsedLine[], purchasedAt?: Date) => void;
  updateItem: (id: string, patch: Partial<InventoryItem>) => void;
  cycleFill: (id: string) => void;
  /** Logs part of an item as used, e.g. 2 of 12 eggs. */
  useSome: (id: string, amount: number) => void;
  finishItem: (id: string, outcome: 'used' | 'tossed') => void;
  cook: (recipe: Recipe) => string[];

  addShopping: (name: string, source?: ShoppingItem['source']) => void;
  toggleShopping: (id: string) => void;
  removeShopping: (id: string) => void;
  refreshSuggestions: () => number;
  /** Moves checked items into the pantry, for trips without a receipt to scan. */
  stockChecked: () => number;
}

const NEXT_FILL: Record<FillLevel, FillLevel> = { full: 'half', half: 'low', low: 'full' };

function buildItem(input: NewItemInput, purchasedAt: Date): InventoryItem {
  const name = input.name.trim();
  const key = ingredientKey(name);
  const category = input.category ?? guessCategory(name);
  const storage = input.storage ?? defaultStorage(category, name);
  const userDate = input.expiresAt !== undefined;
  return {
    id: newId(),
    name,
    key,
    category,
    storage,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? 'each',
    fill: 'full',
    addedAt: purchasedAt.toISOString(),
    expiresAt: userDate ? input.expiresAt! : predictExpiry(key, category, storage, purchasedAt).toISOString(),
    expirySource: userDate ? 'user' : 'predicted',
    price: input.price,
  };
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** Records the state before a change so the user can undo it. */
      const remember = (label: string) => {
        const { items, shopping, log, purchaseCounts } = get();
        set({ lastAction: { label, before: { items, shopping, log, purchaseCounts } } });
      };
      return {
      items: [],
      shopping: [],
      purchaseCounts: {},
      log: [],
      lastAction: null,
      householdId: null,
      scanLog: [],
      recordScan: () => set((s) => ({ scanLog: [new Date().toISOString(), ...s.scanLog].slice(0, 100) })),

      setHousehold: (id) => set({ householdId: id }),
      applyRemote: (data) => set({ ...data, lastAction: null }),

      undo: () => {
        const a = get().lastAction;
        if (a) set({ ...a.before, lastAction: null });
      },
      clearUndo: () => set({ lastAction: null }),

      addItems: (inputs, purchasedAt = new Date()) => {
        const built = inputs.filter((i) => i.name.trim()).map((i) => buildItem(i, purchasedAt));
        if (built.length === 0) return;
        remember(built.length === 1 ? `Added ${built[0].name}` : `Added ${built.length} items`);
        set((s) => {
          const counts = { ...s.purchaseCounts };
          for (const it of built) {
            const prev = counts[it.key];
            counts[it.key] = { name: prev?.name ?? it.name, category: it.category, count: (prev?.count ?? 0) + 1 };
          }
          // Buying something ticks it off the shopping list.
          const bought = new Set(built.map((b) => b.key));
          return {
            items: [...s.items, ...built],
            purchaseCounts: counts,
            shopping: s.shopping.filter((sh) => !bought.has(sh.key)),
          };
        });
      },

      addParsed: (lines, purchasedAt) =>
        get().addItems(
          lines.map((l) => ({ name: l.name, quantity: l.quantity, unit: l.unit, category: l.category, price: l.price })),
          purchasedAt,
        ),

      updateItem: (id, patch) => {
        remember('Edited item');
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
      },

      useSome: (id, amount) => {
        const it = get().items.find((i) => i.id === id);
        if (!it || amount <= 0) return;
        if (amount >= it.quantity) {
          get().finishItem(id, 'used');
          return;
        }
        remember(`Used ${amount} ${it.unit === 'each' ? '' : it.unit + ' '}${it.name}`.replace(/\s+/g, ' '));
        const left = Math.round((it.quantity - amount) * 100) / 100;
        const unitPrice = it.price !== undefined ? it.price / it.quantity : undefined;
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, quantity: left, price: unitPrice !== undefined ? Math.round(unitPrice * left * 100) / 100 : undefined, fill: left / it.quantity <= 0.25 ? 'low' : i.fill }
              : i,
          ),
          log: [
            { id: newId(), name: it.name, at: new Date().toISOString(), outcome: 'used' as const, price: unitPrice !== undefined ? Math.round(unitPrice * amount * 100) / 100 : undefined },
            ...s.log,
          ].slice(0, 500),
        }));
      },

      cycleFill: (id) =>
        set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, fill: NEXT_FILL[it.fill] } : it)) })),

      finishItem: (id, outcome) =>
        set((s) => {
          const it = s.items.find((i) => i.id === id);
          if (!it) return s;
          const before = { items: s.items, shopping: s.shopping, log: s.log, purchaseCounts: s.purchaseCounts };
          // Only the unused share of the price counts as waste.
          const share = it.fill === 'full' ? 1 : it.fill === 'half' ? 0.5 : 0.2;
          const entry: WasteEntry = {
            id: newId(),
            name: it.name,
            price: it.price !== undefined ? Math.round(it.price * (outcome === 'tossed' ? share : 1) * 100) / 100 : undefined,
            at: new Date().toISOString(),
            outcome,
          };
          return {
            items: s.items.filter((i) => i.id !== id),
            log: [entry, ...s.log].slice(0, 500),
            lastAction: { label: outcome === 'used' ? `Used up ${it.name}` : `Threw out ${it.name}`, before },
          };
        }),

      cook: (recipe) => {
        const before = get().items;
        const { inventory, usedUp } = cookRecipe(before, recipe);
        remember(`Cooked ${recipe.title}`);
        const at = new Date().toISOString();
        const priceOf = (name: string) => before.find((i) => i.name === name)?.price;
        set((s) => ({
          items: inventory,
          log: [...usedUp.map((name) => ({ id: newId(), name, at, outcome: 'used' as const, price: priceOf(name) })), ...s.log].slice(0, 500),
        }));
        return usedUp;
      },

      addShopping: (name, source = 'manual') => {
        if (!name.trim()) return;
        const sh = makeShoppingItem(name.trim(), source, newId());
        set((s) => (s.shopping.some((x) => x.key === sh.key && !x.checked) ? s : { shopping: [...s.shopping, sh] }));
      },

      toggleShopping: (id) =>
        set((s) => ({ shopping: s.shopping.map((x) => (x.id === id ? { ...x, checked: !x.checked } : x)) })),

      removeShopping: (id) => {
        remember('Removed from list');
        set((s) => ({ shopping: s.shopping.filter((x) => x.id !== id) }));
      },

      refreshSuggestions: () => {
        const { items, purchaseCounts, shopping } = get();
        const sugg = autoSuggestions(items, purchaseCounts, shopping);
        set({
          shopping: [
            ...shopping,
            ...sugg.map((g) => ({ id: newId(), name: g.name, key: g.key, category: g.category, checked: false, source: 'auto' as const })),
          ],
        });
        return sugg.length;
      },

      stockChecked: () => {
        const checked = get().shopping.filter((x) => x.checked);
        get().addItems(checked.map((c) => ({ name: c.name, category: c.category })));
        set((s) => ({ shopping: s.shopping.filter((x) => !x.checked) }));
        return checked.length;
      },
      };
    },
    {
      name: 'pantry-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        items: s.items,
        shopping: s.shopping,
        purchaseCounts: s.purchaseCounts,
        log: s.log,
        householdId: s.householdId,
        scanLog: s.scanLog,
      }),
    },
  ),
);

export { moneyStats } from '../lib/money';
