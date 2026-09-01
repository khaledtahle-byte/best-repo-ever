'use client';

import { Sheet } from '@/components/ui/sheet';
import { Money } from '@/components/ui/money';
import { useCart, lineTotal } from './cart-provider';
import { VARIANT_LABELS } from './product-card';
import { translator, pick } from '@/lib/i18n';
import { formatLbp } from '@/lib/money';
import type { Addon, Locale, StoreSettings } from '@/lib/types';

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
  addons: Addon[];
  settings: StoreSettings;
  locale: Locale;
  shopOpen: boolean;
}

export function CartSheet({
  open,
  onClose,
  onCheckout,
  addons,
  settings,
  locale,
  shopOpen,
}: CartSheetProps) {
  const t = translator(locale);
  const { lines, subtotal, setQty, remove, clear } = useCart();
  const addonBySlug = new Map(addons.map((a) => [a.slug, a]));
  const belowMinimum = settings.minOrderLbp > 0 && subtotal < settings.minOrderLbp;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('yourCart')}
      footer={
        lines.length ? (
          <div className="mb-1 space-y-3">
            <div className="flex items-center justify-between text-base font-extrabold text-brand-ink">
              <span>{t('subtotal')}</span>
              <Money value={subtotal} locale={locale} rate={settings.usdRate} inline />
            </div>

            {belowMinimum ? (
              <p className="rounded-lg bg-brand-yellow-soft px-3 py-2 text-xs font-bold text-brand-char">
                {t('minOrderWarning')} {formatLbp(settings.minOrderLbp, locale)}
              </p>
            ) : null}

            {!shopOpen ? (
              <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-xs font-bold text-brand-red-dark">
                {t('closedNotice')}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button type="button" onClick={clear} className="btn-ghost">
                {t('clearCart')}
              </button>
              <button
                type="button"
                onClick={onCheckout}
                disabled={belowMinimum || !shopOpen}
                className="btn-primary flex-1 py-3 text-base"
              >
                {t('checkout')}
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {!lines.length ? (
        <div className="py-10 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-brand-cream text-3xl">
            🥙
          </div>
          <p className="text-base font-extrabold text-brand-ink">{t('emptyCart')}</p>
          <p className="mt-1 text-sm text-brand-muted">{t('emptyCartSub')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-brand-line">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-3 py-3.5 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-tight text-brand-ink">
                  {pick(locale, line.nameAr, line.nameEn)}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-brand-muted">
                  {locale === 'ar'
                    ? VARIANT_LABELS[line.variantKind].ar
                    : VARIANT_LABELS[line.variantKind].en}
                  {line.addonSlugs.length
                    ? ` · ${line.addonSlugs
                        .map((slug) => {
                          const addon = addonBySlug.get(slug);
                          return addon ? pick(locale, addon.nameAr, addon.nameEn) : slug;
                        })
                        .join(' · ')}`
                    : ''}
                </p>
                {line.notes ? (
                  <p className="mt-0.5 text-xs italic text-brand-muted">“{line.notes}”</p>
                ) : null}

                <div className="mt-2 flex items-center gap-1">
                  <QtyButton label="−" onClick={() => setQty(line.key, line.qty - 1)} />
                  <span className="w-8 text-center text-sm font-extrabold tabular-nums">
                    {line.qty}
                  </span>
                  <QtyButton label="+" onClick={() => setQty(line.key, line.qty + 1)} />
                  <button
                    type="button"
                    onClick={() => remove(line.key)}
                    className="ms-2 text-xs font-bold text-brand-muted underline underline-offset-2 hover:text-brand-red"
                  >
                    {t('remove')}
                  </button>
                </div>
              </div>

              <Money
                value={lineTotal(line)}
                locale={locale}
                rate={settings.usdRate}
                className="shrink-0 text-sm font-extrabold text-brand-ink"
              />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function QtyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === '+' ? 'Increase' : 'Decrease'}
      className="grid h-7 w-7 place-items-center rounded-md bg-brand-cream text-sm font-extrabold text-brand-ink transition hover:bg-brand-line"
    >
      {label}
    </button>
  );
}
