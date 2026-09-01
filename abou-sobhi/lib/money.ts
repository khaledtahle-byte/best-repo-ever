/**
 * Everything on the printed menu is priced in Lebanese pounds, in the millions.
 * We keep money as whole LBP integers end to end — no floats, no minor unit —
 * because the smallest note anybody handles in the shop is 1,000 L.L.
 *
 * The USD figure is display-only: shops quote a "fresh dollar" rate that moves,
 * so it is derived from a rate the owner sets in the admin panel and is never
 * the number an order is stored against.
 */

/** Groups an integer with thousands separators, always Latin digits. */
export function groupDigits(value: number): string {
  const negative = value < 0;
  const digits = Math.round(Math.abs(value)).toString();
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return negative ? `-${out}` : out;
}

export function formatLbp(value: number, locale: 'ar' | 'en' = 'ar'): string {
  return locale === 'ar' ? `${groupDigits(value)} ل.ل` : `${groupDigits(value)} LBP`;
}

/** Converts LBP to USD at `rate` LBP per dollar. Returns null for a unusable rate. */
export function lbpToUsd(value: number, rate: number): number | null {
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round((value / rate) * 100) / 100;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * The dual price the storefront shows, e.g. `600,000 ل.ل` with `$6.70` beside it.
 * `usd` is null when the owner has switched the dollar display off (rate <= 0).
 */
export function formatMoney(
  value: number,
  opts: { locale?: 'ar' | 'en'; rate?: number } = {},
): { lbp: string; usd: string | null } {
  const usd = opts.rate ? lbpToUsd(value, opts.rate) : null;
  return {
    lbp: formatLbp(value, opts.locale ?? 'ar'),
    usd: usd === null ? null : formatUsd(usd),
  };
}

/** Parses "1,200,000" / "١٢٠٠٠٠٠" / "1.2m" style admin input into whole LBP. */
export function parseLbpInput(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let normalised = '';
  for (const ch of raw.trim()) {
    const arabicIndex = arabicDigits.indexOf(ch);
    normalised += arabicIndex >= 0 ? String(arabicIndex) : ch;
  }
  normalised = normalised.replace(/[\s,_]/g, '').toLowerCase();
  const shorthand = /^(\d+(?:\.\d+)?)(k|m)$/.exec(normalised);
  if (shorthand) {
    const base = Number(shorthand[1]);
    return Math.round(base * (shorthand[2] === 'm' ? 1_000_000 : 1_000));
  }
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  const value = Math.round(Number(normalised));
  return Number.isFinite(value) ? value : null;
}
