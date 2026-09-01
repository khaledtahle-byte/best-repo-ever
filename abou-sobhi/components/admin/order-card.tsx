'use client';

import Link from 'next/link';
import { Money } from '@/components/ui/money';
import { Ltr } from '@/components/ui/ltr';
import { statusLabel, STATUS_COLOURS } from '@/components/storefront/status-timeline';
import { translator, pick } from '@/lib/i18n';
import { formatCode } from '@/lib/order-code';
import type { StoredOrder } from '@/lib/store/orders';
import { formatPhone } from '@/lib/phone';
import { mapsLink, telLink, variantLabel, wazeLink } from '@/lib/share';
import { nextStatuses, type Locale, type OrderStatus } from '@/lib/types';

const ACTION_LABELS: Record<OrderStatus, 'markPreparing' | 'markReady' | 'markDelivering' | 'markDone' | 'cancelOrder'> = {
  new: 'markPreparing',
  preparing: 'markPreparing',
  ready: 'markReady',
  delivering: 'markDelivering',
  done: 'markDone',
  cancelled: 'cancelOrder',
};

/**
 * How long an order has been waiting, and how alarmed the card should look
 * about it. Ten minutes is fine, twenty is late, past that someone needs to
 * see it from across the shop.
 */
function ageStyle(minutes: number): string {
  if (minutes >= 20) return 'bg-brand-red text-white';
  if (minutes >= 10) return 'bg-brand-yellow text-brand-ink';
  return 'bg-brand-cream text-brand-char';
}

interface OrderCardProps {
  order: StoredOrder;
  locale: Locale;
  now: number;
  busy: boolean;
  onAction: (id: number, status: OrderStatus) => void;
}

export function OrderCard({ order, locale, now, busy, onAction }: OrderCardProps) {
  const t = translator(locale);
  const minutes = Math.max(0, Math.floor((now - new Date(order.createdAt).getTime()) / 60_000));
  const actions = nextStatuses(order.status, order.fulfilment);

  return (
    <article
      className={[
        'card flex flex-col gap-3 p-4',
        order.status === 'new' ? 'ring-2 ring-brand-red/60' : '',
      ].join(' ')}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-ink text-sm font-black text-brand-yellow">
              {order.dailyNumber}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-brand-ink">
                {order.customerName}
              </p>
              <Ltr className="block font-mono text-[11px] font-bold text-brand-muted">
                {formatCode(order.code)}
              </Ltr>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-black text-white ${STATUS_COLOURS[order.status]}`}
          >
            {statusLabel(order.status, locale)}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${ageStyle(minutes)}`}>
            {minutes} {locale === 'ar' ? 'د' : 'm'}
          </span>
        </div>
      </header>

      <ul className="space-y-1 rounded-xl bg-brand-paper p-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <span className="font-extrabold text-brand-red">{item.qty}×</span>{' '}
            <span className="font-bold text-brand-ink">{pick(locale, item.nameAr, item.nameEn)}</span>{' '}
            <span className="text-xs font-semibold text-brand-muted">
              ({variantLabel(item.variantKind, locale)})
            </span>
            {item.addons.length ? (
              <span className="block ps-4 text-xs font-semibold text-brand-muted">
                + {item.addons.map((a) => pick(locale, a.nameAr, a.nameEn)).join(' · ')}
              </span>
            ) : null}
            {item.notes ? (
              <span className="block ps-4 text-xs font-bold italic text-brand-red">
                “{item.notes}”
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="rounded-lg bg-brand-yellow-soft px-3 py-2 text-xs font-bold text-brand-char">
          {order.notes}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-muted">
          {order.fulfilment === 'delivery'
            ? `${t('delivery')} · ${pick(locale, order.zoneNameAr, order.zoneNameEn)}`
            : t('pickup')}
        </span>
        <Money
          value={order.totalLbp}
          locale={locale}
          rate={order.usdRate}
          className="text-base font-black text-brand-ink"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <a href={telLink(order.phone)} className="btn-ghost btn-sm">
          <Ltr>{formatPhone(order.phone)}</Ltr>
        </a>
        {order.fulfilment === 'delivery' && order.lat !== null && order.lng !== null ? (
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
        <Link href={`/admin/orders/${order.id}`} className="btn-ghost btn-sm">
          {t('printReceipt')}
        </Link>
      </div>

      {actions.length ? (
        <div className="flex gap-2 border-t border-brand-line pt-3">
          {actions.map((status) => {
            const cancel = status === 'cancelled';
            return (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => onAction(order.id, status)}
                className={cancel ? 'btn-ghost btn-sm' : 'btn-primary flex-1'}
              >
                {cancel ? t('cancelOrder') : t(ACTION_LABELS[status])}
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
