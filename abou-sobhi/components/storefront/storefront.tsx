'use client';

import { useMemo, useRef, useState } from 'react';
import { CartProvider, useCart } from './cart-provider';
import { ProductCard } from './product-card';
import { ItemSheet } from './item-sheet';
import { CartSheet } from './cart-sheet';
import { CheckoutSheet } from './checkout-sheet';
import { Money } from '@/components/ui/money';
import { translator, pick } from '@/lib/i18n';
import type { Locale, Menu, Product, StoreSettings, VariantKind, Zone } from '@/lib/types';

interface StorefrontProps {
  menu: Menu;
  zones: Zone[];
  settings: StoreSettings;
  locale: Locale;
  shopOpen: boolean;
}

export function Storefront(props: StorefrontProps) {
  return (
    <CartProvider menu={props.menu}>
      <StorefrontInner {...props} />
    </CartProvider>
  );
}

type View = 'none' | 'cart' | 'checkout';

function StorefrontInner({ menu, zones, settings, locale, shopOpen }: StorefrontProps) {
  const t = translator(locale);
  const { count, subtotal, ready } = useCart();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>('none');
  const [picked, setPicked] = useState<{ product: Product; variant: VariantKind } | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());

  const categories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        products: category.products.filter((product) =>
          [product.nameAr, product.nameEn, product.descAr, product.descEn]
            .join(' ')
            .toLowerCase()
            .includes(needle),
        ),
      }))
      .filter((category) => category.products.length > 0);
  }, [menu.categories, query]);

  const scrollTo = (slug: string) => {
    const node = sectionRefs.current.get(slug);
    if (!node) return;
    const offset = node.getBoundingClientRect().top + window.scrollY - 132;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  };

  return (
    <>
      {/* Search + category rail, pinned under the header while scrolling. */}
      <div className="sticky top-0 z-30 border-b border-brand-line bg-brand-paper/95 backdrop-blur">
        <div className="container-page py-3">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted ltr:left-3.5 rtl:right-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input
              className="field ps-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
            />
          </div>

          <nav className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {menu.categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => scrollTo(category.slug)}
                className="shrink-0 rounded-full border border-brand-line bg-white px-3.5 py-1.5 text-xs font-extrabold text-brand-char transition hover:border-brand-ink hover:bg-brand-yellow"
              >
                {pick(locale, category.nameAr, category.nameEn)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="container-page pb-40 pt-8">
        {categories.length === 0 ? (
          <p className="py-16 text-center text-sm font-semibold text-brand-muted">
            {t('noResults')}
          </p>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => (
              <section
                key={category.slug}
                id={category.slug}
                ref={(node) => {
                  if (node) sectionRefs.current.set(category.slug, node);
                }}
                className="scroll-mt-36"
              >
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="section-title">{pick(locale, category.nameAr, category.nameEn)}</h2>
                  <span className="h-2 flex-1 rounded-full bg-brand-yellow spit-stripes" />
                </div>

                <div className="grid gap-3">
                  {category.products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      locale={locale}
                      rate={settings.usdRate}
                      onPick={(p, variant) => setPicked({ product: p, variant })}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Sticky order bar: on a phone this is how the cart is ever reached. */}
      {ready && count > 0 ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-4 pt-3">
          <button
            type="button"
            onClick={() => setView('cart')}
            className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl bg-brand-ink px-4 py-3.5 text-white shadow-lift transition hover:bg-brand-char"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-yellow text-sm font-extrabold text-brand-ink">
                {count}
              </span>
              <span className="text-sm font-extrabold">{t('yourCart')}</span>
            </span>
            <Money
              value={subtotal}
              locale={locale}
              rate={settings.usdRate}
              inline
              className="text-sm font-extrabold"
            />
          </button>
        </div>
      ) : null}

      <ItemSheet
        product={picked?.product ?? null}
        initialVariant={picked?.variant ?? null}
        addons={menu.addons}
        locale={locale}
        rate={settings.usdRate}
        onClose={() => setPicked(null)}
      />

      <CartSheet
        open={view === 'cart'}
        onClose={() => setView('none')}
        onCheckout={() => setView('checkout')}
        addons={menu.addons}
        settings={settings}
        locale={locale}
        shopOpen={shopOpen}
      />

      <CheckoutSheet
        open={view === 'checkout'}
        onClose={() => setView('none')}
        onBack={() => setView('cart')}
        zones={zones}
        settings={settings}
        locale={locale}
      />
    </>
  );
}
