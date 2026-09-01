import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';
import { getDb } from '@/lib/db';
import { normaliseCode } from '@/lib/order-code';
import { getOrderByCode } from '@/lib/store/orders';
import { getSettings, isShopOpen } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * A plain form posting to a server action, so a customer can look their order
 * up from the shop's printed receipt with no JavaScript at all.
 */
export default function TrackPage({
  searchParams,
}: {
  searchParams: { notfound?: string };
}) {
  const locale = getLocale();
  const t = translator(locale);
  const settings = getSettings();

  async function findOrder(formData: FormData) {
    'use server';
    const code = normaliseCode(String(formData.get('code') ?? ''));
    const order = code ? getOrderByCode(code, getDb()) : null;
    redirect(order ? `/order/${order.code}` : '/track?notfound=1');
  }

  return (
    <>
      <SiteHeader
        settings={settings}
        locale={locale}
        shopOpen={isShopOpen(settings)}
        returnTo="/track"
      />
      <main className="container-page py-16">
        <div className="mx-auto max-w-md text-center">
          <h1 className="section-title">{t('trackOrder')}</h1>
          <p className="mt-2 text-sm text-brand-muted">{t('trackPrompt')}</p>

          <form action={findOrder} className="mt-6 flex gap-2">
            <input
              name="code"
              required
              maxLength={9}
              dir="ltr"
              autoComplete="off"
              placeholder="K7M-2QX"
              className="field text-center font-mono text-lg font-black uppercase tracking-[.2em]"
            />
            <button type="submit" className="btn-primary px-6">
              {t('track')}
            </button>
          </form>

          {searchParams.notfound ? (
            <p className="mt-4 rounded-lg bg-brand-red-soft px-3 py-2 text-sm font-bold text-brand-red-dark">
              {t('orderNotFound')}
            </p>
          ) : null}

          <Link href="/" className="mt-8 inline-block text-sm font-bold text-brand-muted underline">
            {t('backToMenu')}
          </Link>
        </div>
      </main>
      <SiteFooter settings={settings} locale={locale} />
    </>
  );
}
