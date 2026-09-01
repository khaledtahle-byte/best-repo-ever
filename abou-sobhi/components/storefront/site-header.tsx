import Link from 'next/link';
import { Logo } from './logo';
import { translator } from '@/lib/i18n';
import { telLink } from '@/lib/share';
import type { Locale, StoreSettings } from '@/lib/types';

interface SiteHeaderProps {
  settings: StoreSettings;
  locale: Locale;
  shopOpen: boolean;
  /** Path to return to after switching language. */
  returnTo: string;
}

export function SiteHeader({ settings, locale, shopOpen, returnTo }: SiteHeaderProps) {
  const t = translator(locale);
  const other = locale === 'ar' ? 'en' : 'ar';

  return (
    <header className="bg-brand-ink text-white">
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label={t('brandName')}>
          <Logo settings={settings} locale={locale} />
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={[
              'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold sm:inline-flex',
              shopOpen ? 'bg-state-done/20 text-emerald-300' : 'bg-brand-red/25 text-red-300',
            ].join(' ')}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${shopOpen ? 'bg-emerald-400' : 'bg-red-400'}`}
            />
            {shopOpen ? t('openNow') : t('closedNow')}
          </span>

          <Link
            href="/track"
            className="hidden rounded-lg px-2.5 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/10 hover:text-white sm:block"
          >
            {t('trackOrder')}
          </Link>

          <a
            href={telLink(settings.phone)}
            className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 transition hover:bg-white/20"
            aria-label={t('callUs')}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M5 4h3l2 5-2.5 1.5a12 12 0 0 0 5.5 5.5L15 13l5 2v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <a
            href={`/api/lang?to=${other}&next=${encodeURIComponent(returnTo)}`}
            className="rounded-lg bg-brand-yellow px-3 py-1.5 text-xs font-extrabold text-brand-ink transition hover:bg-brand-yellow-dark"
          >
            {t('langSwitch')}
          </a>
        </div>
      </div>
    </header>
  );
}
