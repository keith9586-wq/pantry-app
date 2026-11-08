import { defaultStorage, guessCategory, ingredientKey } from './normalize';
import type { Category, FillLevel, StorageSpot } from './types';

/** One item seen on a shelf sweep, before the user confirms it. */
export interface ShelfLine {
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  storage: StorageSpot;
  fill: FillLevel;
}

/** Frames kept from one sweep. More frames cost more and rarely find more. */
export const MAX_FRAMES = 8;
/** How often a frame is grabbed while the user pans. */
export const FRAME_INTERVAL_MS = 1200;
/** Frames are shrunk to this width before upload: about 1,050 input tokens each. */
export const FRAME_WIDTH = 1024;

const CATEGORIES: Category[] = [
  'produce', 'dairy', 'eggs', 'meat', 'seafood', 'bakery', 'frozen',
  'grains', 'canned', 'condiments', 'snacks', 'beverages', 'other',
];
const SPOTS: StorageSpot[] = ['fridge', 'freezer', 'pantry'];
const FILLS: FillLevel[] = ['full', 'half', 'low'];

/**
 * Rough cost of one sweep in US dollars on claude-opus-5-5 ($4 per M input, $20 per M output):
 * about 1,050 tokens per 1024x768 frame, ~700 for the prompt, and ~1,500 output tokens.
 */
export function sweepCost(frames: number, outputTokens = 1500): number {
  const input = frames * 1050 + 700;
  return (input * 4 + outputTokens * 20) / 1_000_000;
}

/**
 * Validates the shelf-scan response and merges repeats. Frames overlap, so if the model
 * still lists the same thing twice, keep the larger count rather than adding them up.
 */
export function sanitizeShelfLines(data: unknown): ShelfLine[] {
  const items = (data as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const byKey = new Map<string, ShelfLine>();
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().replace(/\s+/g, ' ') : '';
    if (!name || name.length > 60) continue;
    const quantity =
      typeof r.quantity === 'number' && Number.isFinite(r.quantity) && r.quantity > 0
        ? Math.min(Math.round(r.quantity * 100) / 100, 50)
        : 1;
    const unit = typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim().toLowerCase() : 'each';
    const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : guessCategory(name);
    const storage = SPOTS.includes(r.storage as StorageSpot) ? (r.storage as StorageSpot) : defaultStorage(category, name);
    const fill = FILLS.includes(r.fill as FillLevel) ? (r.fill as FillLevel) : 'full';
    const line: ShelfLine = { name, quantity, unit, category, storage, fill };
    const key = `${ingredientKey(name)}|${storage}`;
    const prev = byKey.get(key);
    if (!prev || line.quantity > prev.quantity) byKey.set(key, line);
  }
  return [...byKey.values()];
}

/** Sends the frames of one sweep to the scan-shelves server function, which calls Claude. */
export async function scanShelves(frames: string[], endpoint: string, authToken?: string): Promise<ShelfLine[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({ frames: frames.slice(0, MAX_FRAMES).map((data) => ({ data, mediaType: 'image/jpeg' })) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Shelf scan service returned ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return sanitizeShelfLines(await res.json());
}

/** Picks evenly spaced frames when more were grabbed than can be sent. */
export function pickFrames<T>(frames: T[], max = MAX_FRAMES): T[] {
  if (frames.length <= max) return frames;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(frames[Math.round((i * (frames.length - 1)) / (max - 1))]);
  return out;
}
