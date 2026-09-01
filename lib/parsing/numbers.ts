/**
 * Number extraction that survives real supplier paperwork: currency symbols,
 * thousands separators in either convention, trailing units, parenthesised
 * negatives and percentages.
 */

const CURRENCY_CHARS = '\\$€£¥₹';

export function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw === null || raw === undefined) return null;

  let text = String(raw).trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text) || text.startsWith('-');
  text = text
    .replace(new RegExp(`[${CURRENCY_CHARS}]`, 'g'), '')
    .replace(/[()]/g, '')
    .replace(/\s/g, '')
    .replace(/^[-+]/, '');

  // Drop trailing units so "18.40/case" and "12.5kg" still yield a number.
  text = text.replace(/(?:\/|per)[a-z]+$/i, '').replace(/[a-z%]+$/i, '');
  if (!text) return null;

  const hasDot = text.includes('.');
  const hasComma = text.includes(',');

  if (hasDot && hasComma) {
    // Whichever separator comes last is the decimal point.
    const decimalSep = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
    const groupSep = decimalSep === '.' ? ',' : '.';
    text = text.split(groupSep).join('');
    if (decimalSep === ',') text = text.replace(',', '.');
  } else if (hasComma) {
    // "1,234" is a group; "12,50" is European decimal notation.
    const parts = text.split(',');
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length !== 3) text = `${parts[0]}.${last}`;
    else text = parts.join('');
  } else if (hasDot) {
    const parts = text.split('.');
    if (parts.length > 2) text = parts.join('');
  }

  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Reads a percentage, accepting "6", "6%" and "0.06". */
export function parsePercent(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const value = parseNumber(text);
  if (value === null) return null;
  // A bare fraction under 1 with no % sign is a ratio, not 0.06%.
  if (!text.includes('%') && value > 0 && value < 1) return value * 100;
  return value;
}

export function parseMoney(raw: unknown): number | null {
  const value = parseNumber(raw);
  return value === null ? null : value;
}

/** True when a token reads like money or a plain quantity rather than a code. */
export function looksNumeric(token: string): boolean {
  return /^[\s(\-+]*[\$€£¥₹]?\s*\d[\d.,]*\s*%?\)?$/.test(token.trim());
}

export function isPercentToken(token: string): boolean {
  return token.trim().endsWith('%');
}
