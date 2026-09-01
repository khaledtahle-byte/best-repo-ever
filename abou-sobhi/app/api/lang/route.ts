import { NextResponse, type NextRequest } from 'next/server';
import { isLocale } from '@/lib/i18n';
import { LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from '@/lib/locale';

/**
 * Language switching as a plain link so it works before hydration, and on the
 * shop's older Android phones where JavaScript sometimes just does not arrive.
 */
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const to = url.searchParams.get('to');
  const next = url.searchParams.get('next') || '/';

  // Only ever redirect within this site — never to an attacker-supplied host.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const response = NextResponse.redirect(new URL(safeNext, url.origin));
  if (isLocale(to)) response.cookies.set(LOCALE_COOKIE, to, LOCALE_COOKIE_OPTIONS);
  return response;
}
