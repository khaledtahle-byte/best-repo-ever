import type { Db } from './db';
import { getDb } from './db';
import { getMenu } from './store/menu';
import { getZone } from './store/zones';
import { getSettings } from './store/settings';
import type {
  CartLineInput,
  Fulfilment,
  OrderItemAddon,
  StoreSettings,
  VariantKind,
} from './types';

export const MAX_QTY_PER_LINE = 50;
export const MAX_LINES = 40;

export interface PricedLine {
  productSlug: string;
  nameAr: string;
  nameEn: string;
  variantKind: VariantKind;
  unitPriceLbp: number;
  addons: OrderItemAddon[];
  addonsTotalLbp: number;
  qty: number;
  lineTotalLbp: number;
  notes: string;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalLbp: number;
  deliveryFeeLbp: number;
  totalLbp: number;
  zoneNameAr: string;
  zoneNameEn: string;
}

export type PricingFailure =
  | { code: 'empty_cart' }
  | { code: 'too_many_lines' }
  | { code: 'invalid_qty'; slug: string }
  | { code: 'unknown_item'; slug: string }
  | { code: 'unavailable'; slug: string }
  | { code: 'unknown_zone' }
  | { code: 'below_minimum'; minimum: number; subtotal: number };

export type PricingResult =
  | { ok: true; cart: PricedCart }
  | { ok: false; error: PricingFailure };

/**
 * Prices a cart from the database, ignoring anything the browser claimed a
 * thing costs. The client sends slugs and quantities; every lira comes from
 * here. This is the only place an order total is ever computed.
 */
export function priceCart(
  input: { lines: CartLineInput[]; fulfilment: Fulfilment; zoneId?: number | null },
  db: Db = getDb(),
  settings: StoreSettings = getSettings(db),
): PricingResult {
  if (!input.lines.length) return { ok: false, error: { code: 'empty_cart' } };
  if (input.lines.length > MAX_LINES) return { ok: false, error: { code: 'too_many_lines' } };

  const menu = getMenu(db, { activeOnly: true });
  const productBySlug = new Map(
    menu.categories.flatMap((c) => c.products).map((p) => [p.slug, p]),
  );
  const addonBySlug = new Map(menu.addons.map((a) => [a.slug, a]));

  const lines: PricedLine[] = [];
  for (const raw of input.lines) {
    const qty = Math.trunc(Number(raw.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_LINE) {
      return { ok: false, error: { code: 'invalid_qty', slug: String(raw.productSlug) } };
    }

    const product = productBySlug.get(raw.productSlug);
    if (!product) return { ok: false, error: { code: 'unknown_item', slug: String(raw.productSlug) } };

    const variant = product.variants.find((v) => v.kind === raw.variantKind);
    if (!variant) return { ok: false, error: { code: 'unavailable', slug: product.slug } };

    // Duplicated add-on slugs are collapsed; each extra is charged once.
    const chosen = new Set(Array.isArray(raw.addonSlugs) ? raw.addonSlugs : []);
    const addons: OrderItemAddon[] = [];
    for (const slug of chosen) {
      if (!product.addonSlugs.includes(slug)) continue;
      const addon = addonBySlug.get(slug);
      if (!addon) continue;
      addons.push({
        slug: addon.slug,
        nameAr: addon.nameAr,
        nameEn: addon.nameEn,
        priceLbp: addon.priceLbp,
      });
    }

    const addonsTotalLbp = addons.reduce((sum, a) => sum + a.priceLbp, 0);
    lines.push({
      productSlug: product.slug,
      nameAr: product.nameAr,
      nameEn: product.nameEn,
      variantKind: variant.kind,
      unitPriceLbp: variant.priceLbp,
      addons,
      addonsTotalLbp,
      qty,
      lineTotalLbp: (variant.priceLbp + addonsTotalLbp) * qty,
      notes: typeof raw.notes === 'string' ? raw.notes.slice(0, 200).trim() : '',
    });
  }

  const subtotalLbp = lines.reduce((sum, line) => sum + line.lineTotalLbp, 0);
  if (settings.minOrderLbp > 0 && subtotalLbp < settings.minOrderLbp) {
    return {
      ok: false,
      error: { code: 'below_minimum', minimum: settings.minOrderLbp, subtotal: subtotalLbp },
    };
  }

  let deliveryFeeLbp = 0;
  let zoneNameAr = '';
  let zoneNameEn = '';
  if (input.fulfilment === 'delivery') {
    const zone = input.zoneId ? getZone(input.zoneId, db) : null;
    if (!zone || !zone.active) return { ok: false, error: { code: 'unknown_zone' } };
    zoneNameAr = zone.nameAr;
    zoneNameEn = zone.nameEn;
    const qualifiesFree =
      settings.freeDeliveryOverLbp > 0 && subtotalLbp >= settings.freeDeliveryOverLbp;
    deliveryFeeLbp = qualifiesFree ? 0 : zone.feeLbp;
  }

  return {
    ok: true,
    cart: {
      lines,
      subtotalLbp,
      deliveryFeeLbp,
      totalLbp: subtotalLbp + deliveryFeeLbp,
      zoneNameAr,
      zoneNameEn,
    },
  };
}
