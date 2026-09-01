'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Menu, VariantKind } from '@/lib/types';

export interface CartLine {
  /** Stable identity: same product, size, extras and note collapse into one line. */
  key: string;
  productSlug: string;
  variantKind: VariantKind;
  addonSlugs: string[];
  qty: number;
  notes: string;
  /** Display snapshot; the server always re-prices before an order is stored. */
  nameAr: string;
  nameEn: string;
  unitPriceLbp: number;
  addonsTotalLbp: number;
}

const STORAGE_KEY = 'abou-sobhi:cart:v1';

export function lineKey(
  productSlug: string,
  variantKind: string,
  addonSlugs: string[],
  notes: string,
): string {
  return [productSlug, variantKind, [...addonSlugs].sort().join('+'), notes.trim()].join('|');
}

export function lineTotal(line: CartLine): number {
  return (line.unitPriceLbp + line.addonsTotalLbp) * line.qty;
}

/**
 * Drops anything the shop has since removed or marked sold out and refreshes
 * prices from the live menu, so a cart left open overnight can never check out
 * at yesterday's prices or order a sandwich that is no longer sold.
 */
function reconcile(lines: CartLine[], menu: Menu): CartLine[] {
  const products = new Map(menu.categories.flatMap((c) => c.products).map((p) => [p.slug, p]));
  const addons = new Map(menu.addons.map((a) => [a.slug, a]));

  const next: CartLine[] = [];
  for (const line of lines) {
    const product = products.get(line.productSlug);
    if (!product) continue;
    const variant = product.variants.find((v) => v.kind === line.variantKind);
    if (!variant) continue;

    const keptAddons = line.addonSlugs.filter(
      (slug) => product.addonSlugs.includes(slug) && addons.has(slug),
    );
    const addonsTotalLbp = keptAddons.reduce((sum, slug) => sum + (addons.get(slug)?.priceLbp ?? 0), 0);

    next.push({
      ...line,
      addonSlugs: keptAddons,
      key: lineKey(line.productSlug, line.variantKind, keptAddons, line.notes),
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      unitPriceLbp: variant.priceLbp,
      addonsTotalLbp,
    });
  }
  return next;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: Omit<CartLine, 'key'>) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ menu, children }: { menu: Menu; children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  // Nothing is read from localStorage during render, so the server and the
  // first client paint agree; `ready` gates the cart UI until rehydration.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      setLines(reconcile(Array.isArray(parsed) ? (parsed as CartLine[]) : [], menu));
    } catch {
      setLines([]);
    }
    setReady(true);
  }, [menu]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Private browsing or a full quota: the cart simply does not persist.
    }
  }, [lines, ready]);

  const add = useCallback((incoming: Omit<CartLine, 'key'>) => {
    const key = lineKey(
      incoming.productSlug,
      incoming.variantKind,
      incoming.addonSlugs,
      incoming.notes,
    );
    setLines((current) => {
      const existing = current.find((l) => l.key === key);
      if (existing) {
        return current.map((l) =>
          l.key === key ? { ...l, qty: Math.min(50, l.qty + incoming.qty) } : l,
        );
      }
      return [...current, { ...incoming, key }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((current) =>
      qty <= 0
        ? current.filter((l) => l.key !== key)
        : current.map((l) => (l.key === key ? { ...l, qty: Math.min(50, qty) } : l)),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((current) => current.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((sum, l) => sum + l.qty, 0),
      subtotal: lines.reduce((sum, l) => sum + lineTotal(l), 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [lines, ready, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
