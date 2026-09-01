import type { Metadata } from 'next';
import Link from 'next/link';
import { statusLabel, STATUS_COLOURS } from '@/components/storefront/status-timeline';
import { Money } from '@/components/ui/money';
import { Ltr } from '@/components/ui/ltr';
import { getDb } from '@/lib/db';
import { formatCode } from '@/lib/order-code';
import { countOrders, listOrders } from '@/lib/store/orders';
import { getSettings } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator, pick } from '@/lib/i18n';
import { formatBeirutDateTime } from '@/lib/time';
import { formatPhone } from '@/lib/phone';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'All orders' };

const PAGE_SIZE = 25;

function isStatus(value: string | undefined): value is OrderStatus {
  return Boolean(value) && (ORDER_STATUSES as string[]).includes(value as string);
}

export default function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string };
}) {
  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const settings = getSettings(db);

  const status = isStatus(searchParams.status) ? searchParams.status : undefined;
  const search = searchParams.q?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const filter = { statuses: status ? [status] : undefined, search };
  const orders = listOrders({ ...filter, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, db);
  const total = countOrders(status ? { statuses: [status] } : {}, db);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkFor = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status, q: search, page: String(page), ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== '1') params.set(key, value);
    }
    const query = params.toString();
    return query ? `/admin/orders?${query}` : '/admin/orders';
  };

  return (
    <main className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{t('allOrders')}</h1>
        <form className="flex gap-2" action="/admin/orders">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={search ?? ''}
            placeholder={locale === 'ar' ? 'اسم، رقم هاتف، أو رقم طلب' : 'Name, phone or order code'}
            className="field w-64"
          />
          <button type="submit" className="btn-ink btn-sm px-4">
            {locale === 'ar' ? 'بحث' : 'Search'}
          </button>
        </form>
      </div>

      <nav className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <FilterPill href={linkFor({ status: undefined, page: '1' })} active={!status}>
          {locale === 'ar' ? 'الكل' : 'All'}
        </FilterPill>
        {ORDER_STATUSES.map((value) => (
          <FilterPill
            key={value}
            href={linkFor({ status: value, page: '1' })}
            active={status === value}
          >
            {statusLabel(value, locale)}
          </FilterPill>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="card px-4 py-16 text-center text-sm font-semibold text-brand-muted">
          {t('noOrdersYet')}
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-brand-line bg-brand-paper text-start">
              <tr className="text-[11px] font-black uppercase tracking-wide text-brand-muted">
                <Th>#</Th>
                <Th>{t('orderCode')}</Th>
                <Th>{t('customer')}</Th>
                <Th>{t('orderType')}</Th>
                <Th>{t('orderStatus')}</Th>
                <Th>{t('placedAt')}</Th>
                <Th className="text-end">{t('total')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-line">
              {orders.map((order) => (
                <tr key={order.id} className="transition hover:bg-brand-paper">
                  <Td className="font-black tabular-nums text-brand-muted">{order.dailyNumber}</Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono font-bold text-brand-ink underline-offset-2 hover:underline"
                    >
                      <Ltr>{formatCode(order.code)}</Ltr>
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-bold text-brand-ink">{order.customerName}</span>
                    <Ltr className="block text-xs text-brand-muted">
                      {formatPhone(order.phone)}
                    </Ltr>
                  </Td>
                  <Td className="text-xs font-semibold text-brand-muted">
                    {order.fulfilment === 'delivery'
                      ? `${t('delivery')} · ${pick(locale, order.zoneNameAr, order.zoneNameEn)}`
                      : t('pickup')}
                  </Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black text-white ${STATUS_COLOURS[order.status]}`}
                    >
                      {statusLabel(order.status, locale)}
                    </span>
                  </Td>
                  <Td className="text-xs tabular-nums text-brand-muted">
                    <Ltr>{formatBeirutDateTime(order.createdAt)}</Ltr>
                  </Td>
                  <Td className="text-end">
                    <Money
                      value={order.totalLbp}
                      locale={locale}
                      rate={settings.usdRate}
                      className="font-black text-brand-ink"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={linkFor({ page: String(page - 1) })} className="btn-ghost btn-sm">
              ‹
            </Link>
          ) : null}
          <span className="text-xs font-bold tabular-nums text-brand-muted">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link href={linkFor({ page: String(page + 1) })} className="btn-ghost btn-sm">
              ›
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}

function FilterPill({
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
      className={[
        'shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition',
        active
          ? 'border-brand-ink bg-brand-ink text-white'
          : 'border-brand-line bg-white text-brand-char hover:border-brand-muted',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-start ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle ${className}`}>{children}</td>;
}
