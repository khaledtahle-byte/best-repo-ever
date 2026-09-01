import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from './i18n';

export const LOCALE_COOKIE = 'lang';

/** Reads the visitor's language choice; Arabic is the shop's default. */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export const LOCALE_COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
} as const;
