/**
 * Product identity. Two quotes for the same thing rarely spell it the same way
 * ("Mozzarella 2.5kg block" vs "MOZZARELLA BLOCK 2.5 KG"), so descriptions are
 * normalised into a stable key and compared with token overlap when the key
 * itself does not match.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'with', 'for', 'per', 'x', 'pack', 'packs',
  'case', 'cases', 'box', 'boxes', 'ea', 'each', 'ct', 'pc', 'pcs', 'item',
  'product', 'code', 'new', 'brand',
]);

const UNIT_SYNONYMS: Record<string, string> = {
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', kgs: 'kg',
  gram: 'g', grams: 'g', gr: 'g', gm: 'g',
  litre: 'l', litres: 'l', liter: 'l', liters: 'l', ltr: 'l', lt: 'l',
  millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  ounce: 'oz', ounces: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  gallon: 'gal', gallons: 'gal',
  dozen: 'dz', doz: 'dz',
};

/** Split "2.5kg" into "2.5 kg" so the number and unit tokenise separately. */
function splitNumbersFromUnits(value: string): string {
  return value.replace(/(\d)\s*([a-z]{1,4})\b/g, '$1 $2');
}

export function tokenizeDescription(description: string): string[] {
  const cleaned = description
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .trim();

  return splitNumbersFromUnits(cleaned)
    .split(/\s+/)
    .map((token) => UNIT_SYNONYMS[token] ?? token)
    .map((token) => (/^\d+\.\d+$/.test(token) ? String(parseFloat(token)) : token))
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

/**
 * A stable identity for a product. A SKU wins outright; otherwise the sorted,
 * normalised description tokens form the key so word order stops mattering.
 */
export function productKey(description: string, sku?: string | null): string {
  const trimmedSku = (sku ?? '').trim();
  if (trimmedSku && /[a-z0-9]/i.test(trimmedSku) && trimmedSku.length >= 3) {
    return `sku:${trimmedSku.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  const tokens = tokenizeDescription(description);
  if (tokens.length === 0) return `raw:${description.trim().toLowerCase().slice(0, 48)}`;
  return tokens.slice().sort().join('-').slice(0, 120);
}

/** Jaccard overlap of description tokens, 0–1. */
export function descriptionSimilarity(a: string, b: string): number {
  const ta = new Set(tokenizeDescription(a));
  const tb = new Set(tokenizeDescription(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  ta.forEach((token) => {
    if (tb.has(token)) intersection += 1;
  });
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const FUZZY_MATCH_THRESHOLD = 0.7;

/** True when two descriptions are confidently the same product. */
export function isSameProduct(
  a: { description: string; sku?: string | null },
  b: { description: string; sku?: string | null },
): boolean {
  if (productKey(a.description, a.sku) === productKey(b.description, b.sku)) return true;
  return descriptionSimilarity(a.description, b.description) >= FUZZY_MATCH_THRESHOLD;
}
