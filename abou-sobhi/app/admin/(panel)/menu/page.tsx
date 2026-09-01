import type { Metadata } from 'next';
import { repriceAction, saveMenuAction } from '../../menu-actions';
import { getDb } from '@/lib/db';
import { getMenu } from '@/lib/store/menu';
import { getSettings } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator, pick } from '@/lib/i18n';
import { groupDigits, lbpToUsd, formatUsd } from '@/lib/money';
import { variantLabel } from '@/lib/share';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Menu' };

export default function AdminMenuPage({ searchParams }: { searchParams: { saved?: string } }) {
  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const menu = getMenu(db);
  const settings = getSettings(db);

  const categoryIds = menu.categories.map((c) => c.id).join(',');
  const productIds = menu.categories.flatMap((c) => c.products.map((p) => p.id)).join(',');
  const variantIds = menu.categories
    .flatMap((c) => c.products.flatMap((p) => p.variants.map((v) => v.id)))
    .join(',');
  const addonIds = menu.addons.map((a) => a.id).join(',');

  return (
    <main className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{t('menuManager')}</h1>
        {searchParams.saved ? (
          <span className="rounded-full bg-state-done/15 px-3 py-1 text-xs font-black text-state-done">
            ✓ {t('saved')}
          </span>
        ) : null}
      </div>

      <form action={repriceAction} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <span className="label">
            {locale === 'ar' ? 'تعديل كل الأسعار بنسبة %' : 'Adjust every price by %'}
          </span>
          <div className="flex items-center gap-2">
            <input
              name="percent"
              type="number"
              step="1"
              min={-90}
              max={500}
              defaultValue={10}
              className="field w-28 text-center tabular-nums"
            />
            <button type="submit" className="btn-ink">
              {locale === 'ar' ? 'طبّق' : 'Apply'}
            </button>
          </div>
        </div>
        <p className="max-w-md text-xs font-semibold leading-relaxed text-brand-muted">
          {locale === 'ar'
            ? 'لما يتحرّك سعر الصرف، غيّر كل المنيو بضغطة. الأسعار بتتقرّب لأقرب 50,000 ل.ل.'
            : 'When the rate moves, reprice the whole board at once. Results round to the nearest 50,000 L.L.'}
        </p>
      </form>

      <form action={saveMenuAction} className="space-y-5">
        <input type="hidden" name="category_ids" value={categoryIds} />
        <input type="hidden" name="product_ids" value={productIds} />
        <input type="hidden" name="variant_ids" value={variantIds} />
        <input type="hidden" name="addon_ids" value={addonIds} />

        {menu.categories.map((category) => (
          <section key={category.id} className="card overflow-hidden">
            <header className="flex items-center justify-between gap-3 border-b border-brand-line bg-brand-paper px-4 py-3">
              <h2 className="text-base font-black text-brand-ink">
                {pick(locale, category.nameAr, category.nameEn)}
              </h2>
              <Switch
                name={`category_active_${category.id}`}
                defaultChecked={category.active}
                onLabel={t('available')}
                offLabel={t('unavailable')}
              />
            </header>

            <ul className="divide-y divide-brand-line">
              {category.products.map((product) => (
                <li key={product.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                  <div className="min-w-48 flex-1">
                    <p className="text-sm font-extrabold text-brand-ink">
                      {pick(locale, product.nameAr, product.nameEn)}
                    </p>
                    {pick(locale, product.descAr, product.descEn) ? (
                      <p className="text-xs text-brand-muted">
                        {pick(locale, product.descAr, product.descEn)}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {product.variants.map((variant) => {
                      const usd = settings.usdRate
                        ? lbpToUsd(variant.priceLbp, settings.usdRate)
                        : null;
                      return (
                        <label key={variant.id} className="block">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-brand-muted">
                            {variantLabel(variant.kind, locale)}
                            {usd !== null ? (
                              <span className="ms-1 font-bold normal-case text-brand-muted/70">
                                {formatUsd(usd)}
                              </span>
                            ) : null}
                          </span>
                          <input
                            name={`variant_price_${variant.id}`}
                            defaultValue={groupDigits(variant.priceLbp)}
                            inputMode="numeric"
                            dir="ltr"
                            className="field w-32 py-1.5 text-center text-sm tabular-nums"
                          />
                        </label>
                      );
                    })}

                    <Switch
                      name={`product_active_${product.id}`}
                      defaultChecked={product.active}
                      onLabel={t('available')}
                      offLabel={t('unavailable')}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="card overflow-hidden">
          <header className="border-b border-brand-line bg-brand-paper px-4 py-3">
            <h2 className="text-base font-black text-brand-ink">{t('extras')}</h2>
          </header>
          <ul className="divide-y divide-brand-line">
            {menu.addons.map((addon) => (
              <li key={addon.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <p className="min-w-48 flex-1 text-sm font-extrabold text-brand-ink">
                  {pick(locale, addon.nameAr, addon.nameEn)}
                </p>
                <input
                  name={`addon_price_${addon.id}`}
                  defaultValue={groupDigits(addon.priceLbp)}
                  inputMode="numeric"
                  dir="ltr"
                  className="field w-32 py-1.5 text-center text-sm tabular-nums"
                />
                <Switch
                  name={`addon_active_${addon.id}`}
                  defaultChecked={addon.active}
                  onLabel={t('available')}
                  offLabel={t('unavailable')}
                />
              </li>
            ))}
          </ul>
        </section>

        <div className="sticky bottom-0 -mx-4 border-t border-brand-line bg-brand-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <button type="submit" className="btn-primary w-full py-3 sm:w-auto sm:px-10">
            {t('save')}
          </button>
        </div>
      </form>
    </main>
  );
}

/** A checkbox that reads as an availability switch to someone behind a counter. */
function Switch({
  name,
  defaultChecked,
  onLabel,
  offLabel,
}: {
  name: string;
  defaultChecked: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      {/* Every styled element is a *sibling* of the input: `peer-*` compiles to
          a general-sibling selector and would not reach a nested child. */}
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        className="relative h-6 w-11 shrink-0 rounded-full bg-brand-line transition
                   after:absolute after:top-0.5 after:h-5 after:w-5 after:rounded-full
                   after:bg-white after:shadow after:transition-transform after:content-['']
                   ltr:after:left-0.5 rtl:after:right-0.5
                   peer-checked:bg-state-done
                   ltr:peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5
                   peer-focus-visible:ring-2 peer-focus-visible:ring-brand-ink peer-focus-visible:ring-offset-2"
      />
      <span className="text-[11px] font-black uppercase tracking-wide text-brand-muted peer-checked:hidden">
        {offLabel}
      </span>
      <span className="hidden text-[11px] font-black uppercase tracking-wide text-state-done peer-checked:inline">
        {onLabel}
      </span>
    </label>
  );
}
