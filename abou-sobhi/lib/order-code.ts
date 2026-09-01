/**
 * Order-code formatting, kept free of Node built-ins so the kitchen board and
 * other client components can render a code without dragging `node:crypto`,
 * `node:fs` and the SQLite driver into the browser bundle.
 *
 * Generating a code needs a CSPRNG and lives server-side in `store/orders`.
 */

/**
 * Crockford-style alphabet: no I, L, O or U, so a code read out over a bad
 * phone line cannot be confused with 1, 0 — or turned into a rude word.
 */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 6;

/** `K7M2QX` reads more easily as `K7M-2QX` on a receipt. */
export function formatCode(code: string): string {
  return code.length === CODE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

/** Accepts a code however the customer types it back at us. */
export function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
}
