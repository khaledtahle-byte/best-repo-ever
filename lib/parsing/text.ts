import type { OfferLineInput, ParseWarning, QuantityTier } from '@/lib/types';
import { isPercentToken, looksNumeric, parseNumber } from '@/lib/parsing/numbers';
import { packHintFromDescription } from '@/lib/parsing/pack-size';
import { parseTierText } from '@/lib/parsing/tabular';

/**
 * Free-text line extraction, used for pasted offers and for the text layer of a
 * PDF. Supplier quotes have no schema, so each line is scored on whether its
 * numbers behave like a quantity, a price and a total.
 */

const SKIP_LINE =
  /^(sub\s*total|total|grand\s*total|vat|tax|freight|delivery|shipping|carriage|terms|payment|notes?|thank|page\s*\d|quotation|quote|date|valid|ref|customer|supplier|address|phone|email|tel|www|bank|iban|registered|company\s*no)/i;

/**
 * Lines that state commercial terms rather than products. The terms extractor
 * already reads these; treating them as line items invents phantom stock.
 */
const TERMS_LINE =
  /\b(rebate|surcharge|fuel\s*levy|pallet\s*fee|drop\s*fee|admin\s*fee|handling\s*fee|payment\s*terms|net\s*\d{1,3}\b|free\s*(?:delivery|freight|carriage|shipping)|carriage\s*paid|minimum\s*order|lead\s*time|valid\s*(?:until|for)|price\s*list\s*valid|ex\s*vat|incl(?:uding)?\s*vat|deposit\s*(?:fee|charge))\b/i;

/** Trailing measure attached to a number: "2.5kg", "330ml", "24x". */
const MEASURE_TOKEN = /^\(?\d+(?:[.,]\d+)?\s*(?:kg|kgs|g|gr|l|ltr|ml|cl|oz|lb|lbs|gal|ct|pk|pcs?|x|mm|cm|in)\)?$/i;
const COMBO_TOKEN = /^\d+\s*[x×]\s*\d/i;

/**
 * "12 x 690g" is one fact about the pack, not a quantity and a weight. Glue it
 * back together before tokenising so it is never mistaken for the order
 * quantity.
 */
function joinPackTokens(line: string): string {
  return line.replace(
    /\b(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|kgs|g|gr|l|ltr|ml|cl|oz|lb|lbs|gal)\b/gi,
    (_match, count: string, size: string, unit: string) => `${count}x${size}${unit}`,
  );
}

interface Extracted {
  line: OfferLineInput;
  confidence: number;
}

export function extractLineFromText(text: string): Extracted | null {
  const raw = text.trim();
  if (raw.length < 4) return null;
  if (SKIP_LINE.test(raw)) return null;
  if (TERMS_LINE.test(raw)) return null;

  const tokens = joinPackTokens(raw).split(/\s{1,}|\t+/).filter(Boolean);
  if (tokens.length < 2) return null;

  const descriptionTokens: string[] = [];
  const numbers: number[] = [];
  const percents: number[] = [];
  let started = false;

  for (const token of tokens) {
    const isMeasure = MEASURE_TOKEN.test(token) || COMBO_TOKEN.test(token);
    if (!started && isMeasure) {
      descriptionTokens.push(token);
      continue;
    }
    if (isPercentToken(token) && looksNumeric(token)) {
      const value = parseNumber(token);
      if (value !== null) percents.push(value);
      started = true;
      continue;
    }
    if (looksNumeric(token) && !isMeasure) {
      const value = parseNumber(token);
      if (value !== null) {
        numbers.push(value);
        started = true;
        continue;
      }
    }
    if (started) {
      // Trailing words after the numbers ("each", "per case") are not description.
      continue;
    }
    descriptionTokens.push(token);
  }

  if (numbers.length === 0) return null;

  let description = descriptionTokens.join(' ').replace(/[|:;,\-–—]+\s*$/, '').trim();
  if (!description || description.length < 2) return null;
  if (!/[a-z]/i.test(description)) return null;

  // A leading alphanumeric code is a SKU, not part of the name.
  let sku: string | null = null;
  const skuMatch = description.match(/^([A-Z0-9][A-Z0-9\-\/]{2,17})\s+(.{2,})$/);
  if (skuMatch && /\d/.test(skuMatch[1]) && /[a-z]/i.test(skuMatch[2])) {
    sku = skuMatch[1];
    description = skuMatch[2].trim();
  }

  let quantity = 1;
  let price: number;
  let statedTotal: number | null = null;
  let confidence = 0.45;

  if (numbers.length === 1) {
    price = numbers[0];
    confidence = 0.35;
  } else {
    const [a, b, ...rest] = numbers;
    quantity = a;
    price = b;
    if (rest.length > 0) statedTotal = rest[rest.length - 1];
    confidence = 0.55;

    // Quantities are whole numbers far more often than prices are.
    if (Number.isInteger(a) && !Number.isInteger(b)) confidence += 0.1;
    else if (!Number.isInteger(a) && Number.isInteger(b) && b > a) {
      // Looks like price-then-quantity; swap.
      quantity = b;
      price = a;
      confidence += 0.05;
    }
  }

  if (price <= 0 || !Number.isFinite(price)) return null;
  if (quantity <= 0) quantity = 1;

  const discountPct = percents.length > 0 ? Math.max(0, Math.min(100, percents[0])) : 0;

  // The strongest signal available: does quantity × price × discount reconcile?
  if (statedTotal !== null) {
    const expected = quantity * price * (1 - discountPct / 100);
    if (expected > 0 && Math.abs(statedTotal - expected) / expected < 0.02) {
      confidence += 0.3;
    } else {
      const swapped = price * quantity;
      if (swapped > 0 && Math.abs(statedTotal - swapped) / swapped < 0.02) confidence += 0.2;
      else confidence -= 0.15;
    }
  }

  if (descriptionTokens.length >= 2) confidence += 0.1;

  const hint = packHintFromDescription(description);

  return {
    line: {
      raw,
      description,
      sku,
      quantity,
      packSize: hint.packSize,
      uom: hint.uom,
      quotedUnitPrice: price,
      discountPct,
      tiers: extractInlineTiers(raw),
      sellUnitPrice: null,
      confidence: Math.max(0.15, Math.min(1, confidence)),
    },
    confidence: Math.max(0.15, Math.min(1, confidence)),
  };
}

function extractInlineTiers(raw: string): QuantityTier[] {
  const bracket = raw.match(/\(([^)]*(?:\+|break|tier)[^)]*)\)/i);
  if (bracket) return parseTierText(bracket[1]);
  return [];
}

export interface TextParse {
  lines: OfferLineInput[];
  warnings: ParseWarning[];
}

export function textToLines(text: string): TextParse {
  const warnings: ParseWarning[] = [];
  const rows = text.split(/\r?\n/);
  const candidates: Extracted[] = [];
  let skippedNumeric = 0;

  for (const row of rows) {
    const trimmed = row.trim();
    if (!trimmed) continue;
    const extracted = extractLineFromText(trimmed);
    if (extracted) candidates.push(extracted);
    else if (/\d/.test(trimmed) && trimmed.length > 8 && !SKIP_LINE.test(trimmed)) skippedNumeric += 1;
  }

  // Table rows cluster around a similar confidence; a stray number in a footer
  // does not. Keep anything plausible but tell the user what was dropped.
  const lines = candidates.filter((c) => c.confidence >= 0.35).map((c) => c.line);

  if (lines.length === 0) {
    warnings.push({
      code: 'no_lines',
      message: 'No product lines could be read from this offer.',
      detail:
        'DealGuard expects each line to contain a description, a quantity and a price. Scanned PDFs with no text layer cannot be read — enter the lines by hand instead.',
    });
  } else if (skippedNumeric > lines.length) {
    warnings.push({
      code: 'partial',
      message: `${skippedNumeric} line${skippedNumeric === 1 ? '' : 's'} with numbers could not be interpreted and were skipped.`,
      detail: 'Check the parsed table below and add anything that is missing.',
    });
  }

  return { lines, warnings };
}
