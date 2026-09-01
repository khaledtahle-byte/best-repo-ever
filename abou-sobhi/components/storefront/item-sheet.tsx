'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Money } from '@/components/ui/money';
import { useCart } from './cart-provider';
import { VARIANT_LABELS } from './product-card';
import { pick, translator } from '@/lib/i18n';
import type { Addon, Locale, Product, VariantKind } from '@/lib/types';

interface ItemSheetProps {
  product: Product | null;
  initialVariant: VariantKind | null;
  addons: Addon[];
  locale: Locale;
  rate: number;
  onClose: () => void;
}

export function ItemSheet({
  product,
  initialVariant,
  addons,
  locale,
  rate,
  onClose,
}: ItemSheetProps) {
  const t = translator(locale);
  const { add } = useCart();
  const [variantKind, setVariantKind] = useState<VariantKind | null>(initialVariant);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  // Reset every time a different item is opened, so choices never leak across.
  useEffect(() => {
    setVariantKind(initialVariant);
    setSelectedAddons([]);
    setQty(1);
    setNotes('');
  }, [product, initialVariant]);

  const availableAddons = useMemo(
    () => (product ? addons.filter((a) => product.addonSlugs.includes(a.slug)) : []),
    [product, addons],
  );

  const variant = product?.variants.find((v) => v.kind === variantKind) ?? null;
  const addonsTotal = availableAddons
    .filter((a) => selectedAddons.includes(a.slug))
    .reduce((sum, a) => sum + a.priceLbp, 0);
  const total = variant ? (variant.priceLbp + addonsTotal) * qty : 0;

  if (!product) return null;

  const toggleAddon = (slug: string) => {
    setSelectedAddons((current) =>
      current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug],
    );
  };

  const submit = () => {
    if (!variant) return;
    add({
      productSlug: product.slug,
      variantKind: variant.kind,
      addonSlugs: selectedAddons,
      qty,
      notes: notes.trim(),
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      unitPriceLbp: variant.priceLbp,
      addonsTotalLbp: addonsTotal,
    });
    onClose();
  };

  return (
    <Sheet
      open={Boolean(product)}
      onClose={onClose}
      title={pick(locale, product.nameAr, product.nameEn)}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!variant}
          className="btn-primary mb-1 w-full justify-between py-3 text-base"
        >
          <span>{t('addToCart')}</span>
          <Money value={total} locale={locale} rate={rate} inline className="font-extrabold" />
        </button>
      }
    >
      {pick(locale, product.descAr, product.descEn) ? (
        <p className="-mt-1 mb-5 text-sm text-brand-muted">
          {pick(locale, product.descAr, product.descEn)}
        </p>
      ) : null}

      {product.variants.length > 1 ? (
        <fieldset className="mb-6">
          <legend className="label">{locale === 'ar' ? 'الحجم' : 'Size'}</legend>
          <div className="grid grid-cols-2 gap-2">
            {product.variants.map((v) => {
              const active = v.kind === variantKind;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantKind(v.kind)}
                  aria-pressed={active}
                  className={[
                    'flex items-center justify-between rounded-xl border-2 px-3 py-3 text-start transition',
                    active
                      ? 'border-brand-ink bg-white shadow-card'
                      : 'border-brand-line bg-white/60 hover:border-brand-muted',
                  ].join(' ')}
                >
                  <span className="text-sm font-bold text-brand-ink">
                    {locale === 'ar' ? VARIANT_LABELS[v.kind].ar : VARIANT_LABELS[v.kind].en}
                  </span>
                  <Money
                    value={v.priceLbp}
                    locale={locale}
                    rate={rate}
                    className="text-xs font-bold text-brand-red"
                  />
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {availableAddons.length ? (
        <fieldset className="mb-6">
          <legend className="label">{t('extras')}</legend>
          <div className="space-y-2">
            {availableAddons.map((addon) => {
              const checked = selectedAddons.includes(addon.slug);
              return (
                <label
                  key={addon.id}
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition',
                    checked ? 'border-brand-ink bg-white' : 'border-brand-line bg-white/60',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAddon(addon.slug)}
                    className="h-4 w-4 shrink-0 accent-brand-red"
                  />
                  <span className="flex-1 text-sm font-semibold text-brand-ink">
                    {pick(locale, addon.nameAr, addon.nameEn)}
                  </span>
                  <span className="text-xs font-bold text-brand-red">
                    + {addon.priceLbp.toLocaleString('en-US')}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="mb-6">
        <span className="label">{t('quantity')}</span>
        <div className="inline-flex items-center gap-1 rounded-xl border border-brand-line bg-white p-1">
          <StepButton label="−" onClick={() => setQty((q) => Math.max(1, q - 1))} />
          <span className="w-12 text-center text-lg font-extrabold tabular-nums text-brand-ink">
            {qty}
          </span>
          <StepButton label="+" onClick={() => setQty((q) => Math.min(50, q + 1))} />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="item-notes">
          {t('notesLabel')}
        </label>
        <input
          id="item-notes"
          className="field"
          value={notes}
          maxLength={200}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </div>
    </Sheet>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label === '+' ? 'Increase' : 'Decrease'}
      className="grid h-9 w-9 place-items-center rounded-lg bg-brand-cream text-lg font-extrabold text-brand-ink transition hover:bg-brand-line"
    >
      {label}
    </button>
  );
}
