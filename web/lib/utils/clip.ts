/**
 * Safely truncate an unknown value to a string of at most `max` characters.
 * Returns '' if the value is not a string.
 */
export function clipString(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s.slice(0, max);
}

/**
 * Safely extract up to `maxItems` strings (each capped at `maxItemLen`) from
 * an unknown array.  Non-string items and empty strings are filtered out.
 */
export function clipArray(arr: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxItemLen));
}
