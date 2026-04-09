/** Case-insensitive identity for a tag (for filtering / dedup). */
export function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Display label: capitalize each word segment separated by space or hyphen. */
export function normalizeTagLabel(tag: string): string {
  const t = tag.trim();
  if (!t) return t;
  return t
    .split(/([- ])/)
    .map((part) => {
      if (part === '-' || part === ' ') return part;
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

export type TagEntry = { key: string; label: string };

/** Dedupe tags by lowercase key; first occurrence wins label normalization from its raw string. */
export function buildTagEntriesFromRecipes(
  recipes: { tags?: string[] | null }[]
): TagEntry[] {
  const map = new Map<string, string>();
  for (const recipe of recipes) {
    for (const raw of recipe.tags || []) {
      const key = normalizeTagKey(raw);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, normalizeTagLabel(raw));
      }
    }
  }
  return Array.from(map.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
