import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';
import { StatusPoller } from '@/components/storefront/status-poller';
import { StatusTimeline } from '@/components/storefront/status-timeline';
import { Money } from '@/components/ui/money';
import { Ltr } from '@/components/ui/ltr';
import { getDb } from '@/lib/db';
import { formatCode } from '@/lib/order-code';
import { getOrderByCode } from '@/lib/store/orders';
import { getSettings, isShopOpen } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator, pick } from '@/lib/i18n';
import { formatBeirutDateTime, etaClock } from '@/lib/time';
import { mapsLink, orderAsText, telLink, variantLabel, whatsappLink } from '@/lib/share';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Order' };

export default function OrderPage({ params }: { params: { code: string } }) {
  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const settings = getSettings(db);
  const order = getOrderByCode(params.code, db);
  if (!order) notFound();

  const live = !['done', 'cancelled'].includes(order.status);
  const etaMinutes =
    settings.prepMinutes + (order.fulfilment === 'delivery' ? settings.deliveryMinutes : 0);
  const eta = etaClock(etaMinutes, new Date(order.createdAt));
  const storeName = pick(locale, settings.storeNameAr, settings.storeNameEn);

  return (
    <>
      <SiteHeader
        settings={settings}
        locale={locale}
        shopOpen={isShopOpen(settings)}
        returnTo={`/order/${order.code}`}
      />
      <StatusPoller active={live} />

      <main className="container-page py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="card overflow-hidden">
            <div className="bg-brand-yellow px-5 py-5">
              <p className="text-xs font-black uppercase tracking-[.18em] text-brand-red">
                {t('orderPlaced')}
              </p>
              <Ltr className="mt-1 block font-mono text-3xl font-black tracking-tight text-brand-ink">
                {formatCode(order.code)}
              </Ltr>
              <p className="mt-1 text-xs font-semibold text-brand-char/80">{t('saveThisCode')}</p>
            </div>

            <div className="space-y-5 p-5">
              <StatusTimeline
                status={order.status}
                fulfilment={order.fulfilment}
                locale={locale}
              />

              <dl className="grid grid-cols-2 gap-3 border-t border-brand-line pt-4 text-sm">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                    {t('placedAt')}
                  </dt>
                  <dd className="font-extrabold tabular-nums text-brand-ink">
                    <Ltr>{formatBeirutDateTime(order.createdAt)}</Ltr>
                  </dd>
                </div>
                {live ? (
                  <div className="text-end">
                    <dt className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                      {t('estimatedReady')}
                    </dt>
                    <dd className="font-extrabold tabular-nums text-brand-ink">≈ {eta}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-base font-extrabold text-brand-ink">{t('orderSummary')}</h2>
            <ul className="divide-y divide-brand-line">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-brand-ink">
                      <span className="text-brand-red">{item.qty}×</span>{' '}
                      {pick(locale, item.nameAr, item.nameEn)}
                    </p>
                    <p className="text-xs font-semibold text-brand-muted">
                      {variantLabel(item.variantKind, locale)}
                      {item.addons.length
                        ? ` · ${item.addons
                            .map((a) => pick(locale, a.nameAr, a.nameEn))
                            .join(' · ')}`
                        : ''}
                    </p>
                    {item.notes ? (
                      <p className="text-xs italic text-brand-muted">“{item.notes}”</p>
                    ) : null}
                  </div>
                  <Money
                    value={item.lineTotalLbp}
                    locale={locale}
                    rate={order.usdRate}
                    className="shrink-0 text-sm font-extrabold text-brand-ink"
                  />
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 border-t border-brand-line pt-4 text-sm">
              <div className="flex justify-between text-brand-muted">
                <dt>{t('subtotal')}</dt>
                <dd className="font-bold text-brand-char">
                  <Money value={order.subtotalLbp} locale={locale} rate={order.usdRate} inline />
                </dd>
              </div>
              {order.deliveryFeeLbp > 0 ? (
                <div className="flex justify-between text-brand-muted">
                  <dt>{t('deliveryFee')}</dt>
                  <dd className="font-bold text-brand-char">
                    <Money
                      value={order.deliveryFeeLbp}
                      locale={locale}
                      rate={order.usdRate}
                      inline
                    />
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-brand-line pt-2 text-base font-black text-brand-ink">
                <dt>{t('total')}</dt>
                <dd>
                  <Money value={order.totalLbp} locale={locale} rate={order.usdRate} inline />
                </dd>
              </div>
            </dl>
          </section>

          {order.fulfilment === 'delivery' ? (
            <section className="card p-5">
              <h2 className="mb-2 text-base font-extrabold text-brand-ink">{t('addressTitle')}</h2>
              <p className="text-sm text-brand-char">
                {[
                  pick(locale, order.zoneNameAr, order.zoneNameEn),
                  order.street,
                  order.building && `${locale === 'ar' ? 'بناية' : 'Bldg'} ${order.building}`,
                  order.floor && `${locale === 'ar' ? 'طابق' : 'Floor'} ${order.floor}`,
                  order.landmark,
                ]
                  .filter(Boolean)
                  .join('، ')}
              </p>
              {order.lat !== null && order.lng !== null ? (
                <a
                  href={mapsLink(order.lat, order.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost btn-sm mt-3"
                >
                  {t('openInMaps')}
                </a>
              ) : null}
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <a href={telLink(settings.phone)} className="btn-ink flex-1">
              {t('callShop')}
            </a>
            {settings.whatsapp ? (
              <a
                href={whatsappLink(settings.whatsapp, orderAsText(order, locale, storeName))}
                target="_blank"
                rel="noreferrer"
                className="btn-yellow flex-1"
              >
                {t('sendOnWhatsapp')}
              </a>
            ) : null}
            <Link href="/" className="btn-ghost flex-1">
              {t('backToMenu')}
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter settings={settings} locale={locale} />
    </>
  );
}
