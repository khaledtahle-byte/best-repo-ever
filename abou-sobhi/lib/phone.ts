/**
 * Lebanese numbers, as people actually type them: `71 123 456`, `03/123456`,
 * `+961 71 123 456`, `0096171123456`, `06 431 000`.
 *
 * The national form is eight digits. The leading zero belongs to `03` and to
 * the landline area codes only — a `71` mobile has none, which is why the
 * international form of `03 123 456` is `+961 3 123 456` while `71 123 456`
 * becomes `+961 71 123 456` with nothing dropped.
 */

/** Mobile ranges written without a leading zero. */
const MOBILE_PREFIXES = ['70', '71', '76', '78', '79', '81'];
/** Ranges written with one: the legacy 03 mobile block and the area codes. */
const ZERO_PREFIXES = ['01', '03', '04', '05', '06', '07', '08', '09'];

/** Reduces any written form to the canonical eight-digit national number. */
export function normaliseLebanesePhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00961')) digits = digits.slice(5);
  else if (digits.startsWith('961') && digits.length > 8) digits = digits.slice(3);
  if (!digits) return null;

  // `+961 3 123 456` arrives as seven digits with its zero stripped.
  if (digits.length === 7 && !digits.startsWith('0')) digits = `0${digits}`;

  // Some people write a trunk zero before a mobile that does not take one.
  if (digits.length === 9 && digits.startsWith('0') && MOBILE_PREFIXES.includes(digits.slice(1, 3))) {
    digits = digits.slice(1);
  }

  if (digits.length !== 8) return null;
  const prefix = digits.slice(0, 2);
  if (MOBILE_PREFIXES.includes(prefix) || ZERO_PREFIXES.includes(prefix)) return digits;
  return null;
}

export function isValidLebanesePhone(raw: string): boolean {
  return normaliseLebanesePhone(raw) !== null;
}

/** The `961XXXXXXXX` form that `wa.me` and `tel:` links want. */
export function toInternational(raw: string): string | null {
  const national = normaliseLebanesePhone(raw);
  if (!national) return null;
  return `961${national.startsWith('0') ? national.slice(1) : national}`;
}

/** `71123456` → `71 123 456`. */
export function formatPhone(raw: string): string {
  const national = normaliseLebanesePhone(raw);
  if (!national) return raw;
  return `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
}
