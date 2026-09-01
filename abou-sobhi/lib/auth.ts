import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'abou_sobhi_staff';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // one long shift

/**
 * Falls back to a documented development password so `npm run dev` works out of
 * the box on the shop's laptop. Production deployments must set both variables;
 * `hasProductionSecrets()` is what the admin UI checks before it stops nagging.
 */
const DEV_PASSWORD = 'abousobhi';
const DEV_SECRET = 'abou-sobhi-development-secret-not-for-production';

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEV_PASSWORD;
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || DEV_SECRET;
}

export function hasProductionSecrets(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD) && Boolean(process.env.SESSION_SECRET);
}

/** Constant-time compare that tolerates differing lengths without leaking them. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // Hash first so the comparison length is fixed regardless of input length.
  const hashA = crypto.createHash('sha256').update(bufA).digest();
  const hashB = crypto.createHash('sha256').update(bufB).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyPassword(input: string): boolean {
  if (typeof input !== 'string' || !input) return false;
  return safeEqual(input, adminPassword());
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createSessionToken(now: number = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  if (!safeEqual(signature, sign(payload))) return false;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const exp = (decoded as { exp?: unknown }).exp;
    return typeof exp === 'number' && exp * 1000 > now;
  } catch {
    return false;
  }
}

/** Server-component / route-handler check for an authenticated staff session. */
export function isStaffAuthenticated(): boolean {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_TTL_SECONDS,
  secure: process.env.NODE_ENV === 'production',
} as const;

/**
 * A shop's admin panel sits on the open internet with one password, so login
 * attempts are throttled per client. In-memory is the right scope here: one
 * process serves one shop.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export function loginAttemptAllowed(key: string, now: number = Date.now()): boolean {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return true;
  return entry.count < MAX_ATTEMPTS;
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
