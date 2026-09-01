import type { Metadata } from 'next';
import Link from 'next/link';
import { RevenueChart } from '@/components/admin/revenue-chart';
import { getDb } from '@/lib/db';
import { dashboardStats } from '@/lib/store/orders';
import { getSettings } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator, pick } from '@/lib/i18n';
import { formatLbp, groupDigits, lbpToUsd, formatUsd } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reports' };

export default function AdminReportsPage({ searchParams }: { searchParams: { range?: string } }) {
  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const settings = getSettings(db);

  const days = searchParams.range === '30' ? 30 : 7;
  const stats = dashboardStats(days, db);

  const periodRevenue = stats.byDay.reduce((sum, day) => sum + day.revenueLbp, 0);
  const periodOrders = stats.byDay.reduce((sum, day) => sum + day.orders, 0);
  const periodAverage = periodOrders ? Math.round(periodRevenue / periodOrders) : 0;
  const periodUsd = settings.usdRate ? lbpToUsd(periodRevenue, settings.usdRate) : null;
  const topQty = Math.max(...stats.topItems.map((item) => item.qty), 1);

  return (
    <main className="space-y-5 p-4 sm:p-6">
      {/* One filter row above everything it scopes. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{t('reports')}</h1>
        <div className="flex gap-1 rounded-xl border border-brand-line bg-white p-1">
          <RangeTab href="/admin/reports" active={days === 7}>
            {t('last7')}
          </RangeTab>
          <RangeTab href="/admin/reports?range=30" active={days === 30}>
            {t('last30')}
          </RangeTab>
        </div>
      </div>

      {/* Hero figure: exactly one per view, proportional figures, same sans. */}
      <section className="card p-5">
        <p className="text-xs font-black uppercase tracking-wide text-brand-muted">
          {locale === 'ar' ? `مبيعات آخر ${days} يوم` : `Revenue, last ${days} days`}
        </p>
        <p className="mt-1 text-5xl font-black leading-none tracking-tight text-brand-ink">
          {formatLbp(periodRevenue, locale)}
        </p>
        <p className="mt-2 text-sm font-bold text-brand-muted">
          {periodUsd !== null ? `${formatUsd(periodUsd)} · ` : ''}
          {periodOrders} {t('ordersLabel')} · {t('avgOrder')} {formatLbp(periodAverage, locale)}
        </p>
      </section>

      <RevenueChart data={stats.byDay} locale={locale} title={t('revenueByDay')} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* The chart's table-view twin — every plotted value readable as text. */}
        <section className="card overflow-hidden">
          <h2 className="border-b border-brand-line bg-brand-paper px-4 py-3 text-sm font-black uppercase tracking-wide text-brand-muted">
            {locale === 'ar' ? 'جدول المبيعات' : 'Revenue table'}
          </h2>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[11px] font-black uppercase tracking-wide text-brand-muted">
                  <th className="px-4 py-2 text-start">{locale === 'ar' ? 'اليوم' : 'Day'}</th>
                  <th className="px-4 py-2 text-end">{t('ordersLabel')}</th>
                  <th className="px-4 py-2 text-end">{t('todayRevenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {[...stats.byDay].reverse().map((day) => (
                  <tr key={day.day}>
                    <td className="px-4 py-2 font-bold tabular-nums text-brand-ink">{day.day}</td>
                    <td className="px-4 py-2 text-end tabular-nums text-brand-muted">
                      {day.orders}
                    </td>
                    <td className="px-4 py-2 text-end font-bold tabular-nums text-brand-ink">
                      {groupDigits(day.revenueLbp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-brand-line bg-brand-paper px-4 py-3 text-sm font-black uppercase tracking-wide text-brand-muted">
            {t('topItems')}
          </h2>
          {stats.topItems.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm font-semibold text-brand-muted">
              {t('noOrdersYet')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-black uppercase tracking-wide text-brand-muted">
                  <th className="px-4 py-2 text-start">{locale === 'ar' ? 'الصنف' : 'Item'}</th>
                  <th className="px-4 py-2 text-end">{locale === 'ar' ? 'العدد' : 'Qty'}</th>
                  <th className="px-4 py-2 text-end">{t('total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-line">
                {stats.topItems.map((item) => (
                  <tr key={`${item.nameAr}-${item.nameEn}`}>
                    <td className="px-4 py-2">
                      <span className="block font-bold text-brand-ink">
                        {pick(locale, item.nameAr, item.nameEn)}
                      </span>
                      {/* Ranked magnitude, one series, same hue as the chart; the
                          unfilled track is a lighter step so it reads as a meter. */}
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-brand-red/12">
                        <span
                          className="block h-full rounded-full bg-brand-red"
                          style={{ width: `${(item.qty / topQty) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-2 text-end font-black tabular-nums text-brand-ink">
                      {item.qty}
                    </td>
                    <td className="px-4 py-2 text-end tabular-nums text-brand-muted">
                      {groupDigits(item.revenueLbp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

function RangeTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'rounded-lg px-3.5 py-1.5 text-xs font-extrabold transition',
        active ? 'bg-brand-ink text-white' : 'text-brand-muted hover:bg-brand-cream',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
