/**
 * Derives the R2 object key for a size variant from the base file key.
 * Rule: `${key}_${width}w`
 * Example: "images/abc_480w", "images/abc_1200w"
 * No new DB column is needed — the name is computed on demand (content design 14).
 */
export function variantKey(key: string, width: number): string {
  return `${key}_${width}w`;
}
