import { formatLbp, lbpToUsd, formatUsd } from '@/lib/money';
import { formatCode } from '@/lib/order-code';
import type { StoredOrder } from '@/lib/store/orders';
import { formatBeirutDateTime } from '@/lib/time';
import { formatPhone } from '@/lib/phone';
import { variantLabel } from '@/lib/share';
import { pick, translator } from '@/lib/i18n';
import { Ltr } from '@/components/ui/ltr';
import type { Locale, StoreSettings } from '@/lib/types';

/**
 * Laid out for an 80mm thermal printer: one narrow column, no colour, no
 * background fills. On screen it doubles as the order's detail view.
 */
export function Receipt({
  order,
  settings,
  locale,
}: {
  order: StoredOrder;
  settings: StoreSettings;
  locale: Locale;
}) {
  const t = translator(locale);
  const usd = order.usdRate ? lbpToUsd(order.totalLbp, order.usdRate) : null;

  return (
    <div className="receipt card mx-auto max-w-sm p-5 print:border-0 print:shadow-none">
      <header className="border-b border-dashed border-brand-line pb-3 text-center">
        <p className="text-lg font-black text-brand-ink">
          {pick(locale, settings.storeNameAr, settings.storeNameEn)}
        </p>
        <p className="text-xs text-brand-muted">
          {pick(locale, settings.addressAr, settings.addressEn)}
        </p>
        <Ltr className="block text-xs text-brand-muted">{formatPhone(settings.phone)}</Ltr>
      </header>

      <div className="flex items-baseline justify-between border-b border-dashed border-brand-line py-3">
        <span className="text-3xl font-black tabular-nums text-brand-ink">
          #{order.dailyNumber}
        </span>
        <Ltr className="font-mono text-sm font-bold">{formatCode(order.code)}</Ltr>
      </div>

      <dl className="space-y-0.5 border-b border-dashed border-brand-line py-3 text-xs">
        <Line label={t('placedAt')} value={<Ltr>{formatBeirutDateTime(order.createdAt)}</Ltr>} />
        <Line
          label={t('orderType')}
          value={
            order.fulfilment === 'delivery'
              ? `${t('delivery')} — ${pick(locale, order.zoneNameAr, order.zoneNameEn)}`
              : t('pickup')
          }
        />
        <Line
          label={t('customer')}
          value={
            <>
              {order.customerName} · <Ltr>{formatPhone(order.phone)}</Ltr>
            </>
          }
        />
        <Line
          label={t('paymentMethod')}
          value={order.payment === 'cash_usd' ? t('cashUsd') : t('cash')}
        />
      </dl>

      <ul className="space-y-2 border-b border-dashed border-brand-line py-3 text-sm">
        {order.items.map((item) => (
          <li key={item.id}>
            <div className="flex justify-between gap-2 font-bold">
              <span>
                {item.qty}× {pick(locale, item.nameAr, item.nameEn)}
                <span className="font-normal text-brand-muted">
                  {' '}
                  ({variantLabel(item.variantKind, locale)})
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{formatLbp(item.lineTotalLbp, locale)}</span>
            </div>
            {item.addons.map((addon) => (
              <div key={addon.slug} className="ps-4 text-xs text-brand-muted">
                + {pick(locale, addon.nameAr, addon.nameEn)}
              </div>
            ))}
            {item.notes ? <div className="ps-4 text-xs italic">“{item.notes}”</div> : null}
          </li>
        ))}
      </ul>

      <dl className="space-y-1 py-3 text-sm">
        <Line label={t('subtotal')} value={formatLbp(order.subtotalLbp, locale)} strong />
        {order.deliveryFeeLbp > 0 ? (
          <Line label={t('deliveryFee')} value={formatLbp(order.deliveryFeeLbp, locale)} strong />
        ) : null}
        <div className="flex justify-between border-t border-brand-line pt-2 text-base font-black">
          <dt>{t('total')}</dt>
          <dd className="tabular-nums">{formatLbp(order.totalLbp, locale)}</dd>
        </div>
        {usd !== null ? (
          <div className="flex justify-between text-xs font-bold text-brand-muted">
            <dt>≈ USD</dt>
            <dd className="tabular-nums">{formatUsd(usd)}</dd>
          </div>
        ) : null}
      </dl>

      {order.fulfilment === 'delivery' ? (
        <div className="border-t border-dashed border-brand-line pt-3 text-xs">
          <p className="font-black uppercase tracking-wide">{t('addressTitle')}</p>
          <p className="mt-0.5 leading-relaxed">
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
            <Ltr className="mt-1 block font-mono">
              {order.lat.toFixed(5)}, {order.lng.toFixed(5)}
            </Ltr>
          ) : null}
        </div>
      ) : null}

      {order.notes ? (
        <p className="mt-3 border-t border-dashed border-brand-line pt-3 text-xs font-bold">
          {order.notes}
        </p>
      ) : null}

      <p className="mt-4 text-center text-xs text-brand-muted">
        {locale === 'ar' ? 'شكراً لطلبك 🙏' : 'Thank you for your order 🙏'}
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-brand-muted">{label}</dt>
      <dd className={`text-end tabular-nums ${strong ? 'font-bold' : ''}`}>{value}</dd>
    </div>
  );
}
