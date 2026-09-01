import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateStatusAction } from '../../../actions';
import { Receipt } from '@/components/admin/receipt';
import { PrintButton } from '@/components/admin/print-button';
import { Ltr } from '@/components/ui/ltr';
import { statusLabel, STATUS_COLOURS } from '@/components/storefront/status-timeline';
import { getDb } from '@/lib/db';
import { getOrderById } from '@/lib/store/orders';
import { getSettings } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator, pick } from '@/lib/i18n';
import { formatBeirutDateTime } from '@/lib/time';
import { mapsLink, orderAsText, telLink, wazeLink, whatsappLink } from '@/lib/share';
import { nextStatuses, type OrderStatus } from '@/lib/types';

/** What a member of staff is about to *do*, not the status they land on. */
const STATUS_ACTIONS: Record<OrderStatus, 'markPreparing' | 'markReady' | 'markDelivering' | 'markDone' | 'cancelOrder'> = {
  new: 'markPreparing',
  preparing: 'markPreparing',
  ready: 'markReady',
  delivering: 'markDelivering',
  done: 'markDone',
  cancelled: 'cancelOrder',
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order detail' };

export default function AdminOrderPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const settings = getSettings(db);
  const order = getOrderById(Number(params.id), db);
  if (!order) notFound();

  const actions = nextStatuses(order.status, order.fulfilment);
  const storeName = pick(locale, settings.storeNameAr, settings.storeNameEn);

  return (
    <main className="p-4 sm:p-6">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className="btn-ghost btn-sm">
            ‹ {t('allOrders')}
          </Link>
          <h1 className="text-xl font-black text-brand-ink">
            {t('orderDetails')}
            <span
              className={`ms-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-black text-white ${STATUS_COLOURS[order.status]}`}
            >
              {statusLabel(order.status, locale)}
            </span>
          </h1>
        </div>
        <PrintButton label={t('printReceipt')} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <Receipt order={order} settings={settings} locale={locale} />

        <div className="no-print space-y-4">
          {actions.length ? (
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-brand-muted">
                {t('orderStatus')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {actions.map((status) => (
                  <form key={status} action={updateStatusAction}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="status" value={status} />
                    <button
                      type="submit"
                      className={status === 'cancelled' ? 'btn-ghost' : 'btn-primary'}
                    >
                      {t(STATUS_ACTIONS[status])}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          ) : null}

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-brand-muted">
              {t('customer')}
            </h2>
            <div className="flex flex-wrap gap-2">
              <a href={telLink(order.phone)} className="btn-ink btn-sm">
                {t('callCustomer')}
              </a>
              <a
                href={whatsappLink(order.phone, orderAsText(order, order.locale, storeName))}
                target="_blank"
                rel="noreferrer"
                className="btn-yellow btn-sm"
              >
                {t('whatsapp')}
              </a>
              {order.lat !== null && order.lng !== null ? (
                <>
                  <a
                    href={mapsLink(order.lat, order.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    {t('openInMaps')}
                  </a>
                  <a
                    href={wazeLink(order.lat, order.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    Waze
                  </a>
                </>
              ) : null}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-brand-muted">
              {locale === 'ar' ? 'سجلّ الحالة' : 'Status history'}
            </h2>
            <ol className="space-y-2">
              {order.events.map((event, index) => (
                <li key={index} className="flex items-center gap-3 text-sm">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOURS[event.status]}`}
                  />
                  <span className="font-bold text-brand-ink">
                    {statusLabel(event.status, locale)}
                  </span>
                  <Ltr className="ms-auto text-xs tabular-nums text-brand-muted">
                    {formatBeirutDateTime(event.at)}
                  </Ltr>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
