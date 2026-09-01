import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import { priceCart } from '@/lib/pricing';
import { getSettings, saveSettings } from '@/lib/store/settings';
import { setProductActive } from '@/lib/store/menu';
import { listZones } from '@/lib/store/zones';

let db: Db;
let zoneId: number;

beforeEach(() => {
  db = createTestDb();
  zoneId = listZones(db, { activeOnly: true })[0].id;
});

const line = (over: Record<string, unknown> = {}) => ({
  productSlug: 'shawarma-chicken-lebanese',
  variantKind: 'sandwich' as const,
  addonSlugs: [] as string[],
  qty: 1,
  ...over,
});

describe('priceCart', () => {
  it('prices from the database, not from anything the client sent', () => {
    const result = priceCart(
      // A tampered payload carrying its own price fields must be ignored.
      { lines: [line({ unitPriceLbp: 1, lineTotalLbp: 1 })], fulfilment: 'pickup' },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.lines[0].unitPriceLbp).toBe(600_000);
    expect(result.cart.subtotalLbp).toBe(600_000);
    expect(result.cart.totalLbp).toBe(600_000);
  });

  it('multiplies add-ons into every unit of the line', () => {
    const result = priceCart(
      { lines: [line({ addonSlugs: ['cheese', 'nuts'], qty: 2 })], fulfilment: 'pickup' },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // (600,000 + 150,000 + 150,000) × 2
    expect(result.cart.lines[0].lineTotalLbp).toBe(1_800_000);
  });

  it('drops an add-on the product does not offer', () => {
    const result = priceCart(
      // Pizza takes cheese and double, never nuts.
      { lines: [line({ productSlug: 'pizza-mix', variantKind: 'platter', addonSlugs: ['nuts'] })], fulfilment: 'pickup' },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.lines[0].addons).toHaveLength(0);
    expect(result.cart.lines[0].lineTotalLbp).toBe(1_750_000);
  });

  it('charges a duplicated add-on once', () => {
    const result = priceCart(
      { lines: [line({ addonSlugs: ['cheese', 'cheese', 'cheese'] })], fulfilment: 'pickup' },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.lines[0].addonsTotalLbp).toBe(150_000);
  });

  it('refuses a size the shop does not sell', () => {
    // Shawarma Al-Rayes is a sandwich only; there is no platter price on the card.
    const result = priceCart(
      { lines: [line({ productSlug: 'shawarma-al-rayes', variantKind: 'platter' })], fulfilment: 'pickup' },
      db,
    );
    expect(result).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });

  it('refuses an item that has been switched off', () => {
    const product = db
      .prepare("SELECT id FROM products WHERE slug = 'shawarma-chicken-lebanese'")
      .get() as { id: number };
    setProductActive(product.id, false, db);
    expect(priceCart({ lines: [line()], fulfilment: 'pickup' }, db)).toMatchObject({
      ok: false,
      error: { code: 'unknown_item' },
    });
  });

  it('rejects an empty cart and a nonsense quantity', () => {
    expect(priceCart({ lines: [], fulfilment: 'pickup' }, db)).toMatchObject({
      ok: false,
      error: { code: 'empty_cart' },
    });
    expect(priceCart({ lines: [line({ qty: 0 })], fulfilment: 'pickup' }, db)).toMatchObject({
      ok: false,
      error: { code: 'invalid_qty' },
    });
    expect(priceCart({ lines: [line({ qty: 9_999 })], fulfilment: 'pickup' }, db)).toMatchObject({
      ok: false,
      error: { code: 'invalid_qty' },
    });
  });

  it('adds the zone fee for delivery and nothing for pickup', () => {
    const delivery = priceCart({ lines: [line()], fulfilment: 'delivery', zoneId }, db);
    expect(delivery.ok).toBe(true);
    if (!delivery.ok) return;
    expect(delivery.cart.deliveryFeeLbp).toBe(100_000);
    expect(delivery.cart.totalLbp).toBe(700_000);

    const pickup = priceCart({ lines: [line()], fulfilment: 'pickup' }, db);
    expect(pickup.ok).toBe(true);
    if (!pickup.ok) return;
    expect(pickup.cart.deliveryFeeLbp).toBe(0);
  });

  it('waives the fee once the free-delivery threshold is met', () => {
    saveSettings({ free_delivery_over_lbp: '1200000' }, db);
    const result = priceCart(
      { lines: [line({ qty: 2 })], fulfilment: 'delivery', zoneId },
      db,
      getSettings(db),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cart.subtotalLbp).toBe(1_200_000);
    expect(result.cart.deliveryFeeLbp).toBe(0);
  });

  it('requires a real zone for a delivery', () => {
    expect(priceCart({ lines: [line()], fulfilment: 'delivery', zoneId: null }, db)).toMatchObject({
      ok: false,
      error: { code: 'unknown_zone' },
    });
    expect(priceCart({ lines: [line()], fulfilment: 'delivery', zoneId: 9999 }, db)).toMatchObject({
      ok: false,
      error: { code: 'unknown_zone' },
    });
  });

  it('holds the line on the minimum order', () => {
    saveSettings({ min_order_lbp: '1000000' }, db);
    const result = priceCart({ lines: [line()], fulfilment: 'pickup' }, db, getSettings(db));
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'below_minimum', minimum: 1_000_000, subtotal: 600_000 },
    });
  });
});
