import { describe, expect, it } from 'vitest';
import {
  clearLoginAttempts,
  createSessionToken,
  loginAttemptAllowed,
  recordLoginFailure,
  verifyPassword,
  verifySessionToken,
} from '@/lib/auth';

describe('verifyPassword', () => {
  it('accepts the configured password and nothing else', () => {
    // No ADMIN_PASSWORD is set under test, so the documented dev default applies.
    expect(verifyPassword('abousobhi')).toBe(true);
    expect(verifyPassword('abousobh')).toBe(false);
    expect(verifyPassword('')).toBe(false);
    expect(verifyPassword('abousobhi ')).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a freshly issued token', () => {
    expect(verifySessionToken(createSessionToken())).toBe(true);
  });

  it('rejects a token whose payload was edited', () => {
    const token = createSessionToken();
    const [, signature] = token.split('.');
    const forged = `${Buffer.from(JSON.stringify({ exp: 9e12 })).toString('base64url')}.${signature}`;
    expect(verifySessionToken(forged)).toBe(false);
  });

  it('rejects rubbish and missing tokens', () => {
    expect(verifySessionToken(undefined)).toBe(false);
    expect(verifySessionToken('')).toBe(false);
    expect(verifySessionToken('not-a-token')).toBe(false);
    expect(verifySessionToken('a.b')).toBe(false);
  });

  it('expires a shift-old token', () => {
    const issued = Date.now();
    const token = createSessionToken(issued);
    expect(verifySessionToken(token, issued + 11 * 60 * 60 * 1000)).toBe(true);
    expect(verifySessionToken(token, issued + 13 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('login throttling', () => {
  it('locks a client out after repeated failures and lets it back in later', () => {
    const key = 'test-client';
    clearLoginAttempts(key);
    const start = Date.now();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(loginAttemptAllowed(key, start)).toBe(true);
      recordLoginFailure(key, start);
    }
    expect(loginAttemptAllowed(key, start)).toBe(false);

    // The window is ten minutes.
    expect(loginAttemptAllowed(key, start + 11 * 60 * 1000)).toBe(true);
    clearLoginAttempts(key);
  });

  it('forgets past failures after a successful sign-in', () => {
    const key = 'another-client';
    for (let attempt = 0; attempt < 8; attempt += 1) recordLoginFailure(key);
    expect(loginAttemptAllowed(key)).toBe(false);
    clearLoginAttempts(key);
    expect(loginAttemptAllowed(key)).toBe(true);
  });
});
