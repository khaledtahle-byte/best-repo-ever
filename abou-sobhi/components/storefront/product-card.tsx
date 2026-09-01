'use client';

import { Money } from '@/components/ui/money';
import { pick, translator } from '@/lib/i18n';
import type { Locale, Product, VariantKind } from '@/lib/types';

const BADGES: Record<string, { ar: string; en: string; className: string }> = {
  signature: {
    ar: 'نجم المحل',
    en: 'Signature',
    className: 'bg-brand-ink text-brand-yellow',
  },
  popular: {
    ar: 'الأكثر طلباً',
    en: 'Best seller',
    className: 'bg-brand-yellow text-brand-ink',
  },
  spicy: {
    ar: 'حار',
    en: 'Spicy',
    className: 'bg-brand-red text-white',
  },
};

export const VARIANT_LABELS: Record<VariantKind, { ar: string; en: string }> = {
  sandwich: { ar: 'سندويش', en: 'Sandwich' },
  platter: { ar: 'صحن', en: 'Platter' },
  baguette: { ar: 'باجيت', en: 'Baguette' },
};

interface ProductCardProps {
  product: Product;
  locale: Locale;
  rate: number;
  onPick: (product: Product, variantKind: VariantKind) => void;
}

export function ProductCard({ product, locale, rate, onPick }: ProductCardProps) {
  const t = translator(locale);
  const name = pick(locale, product.nameAr, product.nameEn);
  const description = pick(locale, product.descAr, product.descEn);
  const badge = BADGES[product.badge];
  const soldOut = product.variants.length === 0;

  return (
    <article className="card group relative flex flex-col gap-3 p-4 transition hover:shadow-lift sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-extrabold leading-tight text-brand-ink sm:text-lg">
            {name}
          </h3>
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${badge.className}`}
            >
              {locale === 'ar' ? badge.ar : badge.en}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm leading-snug text-brand-muted">{description}</p>
        ) : null}
      </div>

      {soldOut ? (
        <span className="shrink-0 rounded-lg bg-brand-cream px-3 py-2 text-xs font-bold text-brand-muted">
          {t('soldOut')}
        </span>
      ) : (
        <div className="flex shrink-0 flex-wrap items-stretch gap-2">
          {product.variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => onPick(product, variant.kind)}
              className="flex items-center gap-2.5 rounded-xl border border-brand-line bg-brand-paper px-2.5 py-2 text-start transition hover:border-brand-ink hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
            >
              <span className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">
                {locale === 'ar'
                  ? VARIANT_LABELS[variant.kind].ar
                  : VARIANT_LABELS[variant.kind].en}
              </span>
              <Money
                value={variant.priceLbp}
                locale={locale}
                rate={rate}
                className="price-chip text-xs"
                usdClassName="text-[9px] font-semibold opacity-80"
              />
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
