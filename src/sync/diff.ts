/**
 * Compares two versions of a collection keyed by `id` and returns what changed.
 * Rows are compared by their serialized content, so any field change counts.
 */
export function diffById<T extends { id: string }>(before: T[], after: T[]): { upserts: T[]; deletes: string[] } {
  const prev = new Map(before.map((x) => [x.id, JSON.stringify(x)]));
  const next = new Set(after.map((x) => x.id));
  const upserts = after.filter((x) => prev.get(x.id) !== JSON.stringify(x));
  const deletes = before.filter((x) => !next.has(x.id)).map((x) => x.id);
  return { upserts, deletes };
}

/** Joins two collections by id; entries in `preferred` win. Used when merging a device into a household. */
export function unionById<T extends { id: string }>(preferred: T[], other: T[]): T[] {
  const seen = new Set(preferred.map((x) => x.id));
  return [...preferred, ...other.filter((x) => !seen.has(x.id))];
}
