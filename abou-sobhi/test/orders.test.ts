import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db } from '@/lib/db';
import { priceCart, type PricedCart } from '@/lib/pricing';
import { formatCode, normaliseCode } from '@/lib/order-code';
import {
  createOrder,
  dashboardStats,
  getOrderByCode,
  listActiveOrders,
  updateOrderStatus,
} from '@/lib/store/orders';
import { listZones } from '@/lib/store/zones';
import { nextStatuses } from '@/lib/types';

let db: Db;
let zoneId: number;

beforeEach(() => {
  db = createTestDb();
  zoneId = listZones(db, { activeOnly: true })[0].id;
});

function cartOf(qty = 1): PricedCart {
  const priced = priceCart(
    {
      lines: [
        {
          productSlug: 'shawarma-meat-lebanese',
          variantKind: 'sandwich',
          addonSlugs: ['cheese'],
          qty,
        },
      ],
      fulfilment: 'delivery',
      zoneId,
    },
    db,
  );
  if (!priced.ok) throw new Error(`fixture failed to price: ${priced.error.code}`);
  return priced.cart;
}

function place(qty = 1) {
  return createOrder(
    {
      cart: cartOf(qty),
      fulfilment: 'delivery',
      customerName: 'خالد',
      phone: '71123456',
      zoneId,
      street: 'شارع المئتين',
      building: '12',
      floor: '3',
      landmark: 'فوق الصيدلية',
      lat: 34.4367,
      lng: 35.8497,
      notes: 'الجرس خربان',
      payment: 'cash_lbp',
      usdRate: 89_500,
      locale: 'ar',
    },
    db,
  );
}

describe('createOrder', () => {
  it('stores the priced cart and reads it back whole', () => {
    const order = place(2);
    const found = getOrderByCode(order.code, db);

    expect(found).not.toBeNull();
    expect(found?.items).toHaveLength(1);
    expect(found?.items[0].qty).toBe(2);
    expect(found?.items[0].addons.map((a) => a.slug)).toEqual(['cheese']);
    // (750,000 + 150,000) × 2 + 100,000 delivery
    expect(found?.subtotalLbp).toBe(1_800_000);
    expect(found?.totalLbp).toBe(1_900_000);
    expect(found?.lat).toBeCloseTo(34.4367, 4);
  });

  it('opens every order at "new" with a matching first event', () => {
    const order = place();
    expect(order.status).toBe('new');
    expect(order.events).toEqual([{ status: 'new', at: expect.any(String) }]);
  });

  it('issues an unguessable code and a per-day counter for the kitchen', () => {
    const first = place();
    const second = place();

    expect(first.code).toMatch(/^[0-9A-Z]{6}$/);
    expect(first.code).not.toBe(second.code);
    // No I, L, O or U — they are misheard over the phone.
    expect(first.code).not.toMatch(/[ILOU]/);
    expect(first.dailyNumber).toBe(1);
    expect(second.dailyNumber).toBe(2);
  });

  it('snapshots names and the zone so a later menu edit cannot rewrite history', () => {
    const order = place();
    db.prepare("UPDATE products SET name_ar = 'اسم جديد' WHERE slug = 'shawarma-meat-lebanese'").run();
    db.prepare('UPDATE zones SET name_ar = ?, fee_lbp = 999 WHERE id = ?').run('منطقة تانية', zoneId);

    const found = getOrderByCode(order.code, db);
    expect(found?.items[0].nameAr).toBe('شاورما لحمة خبز عادي');
    expect(found?.zoneNameAr).toBe('التل');
    expect(found?.deliveryFeeLbp).toBe(100_000);
  });
});

describe('order codes', () => {
  it('reads back a code however the customer types it', () => {
    const order = place();
    expect(normaliseCode(formatCode(order.code).toLowerCase())).toBe(order.code);
    expect(getOrderByCode(formatCode(order.code), db)?.id).toBe(order.id);
  });

  it('does not find an order that is not there', () => {
    expect(getOrderByCode('ZZZZZZ', db)).toBeNull();
  });
});

describe('status flow', () => {
  it('walks a delivery through the kitchen and out the door', () => {
    const order = place();
    for (const status of ['preparing', 'ready', 'delivering', 'done'] as const) {
      expect(nextStatuses(getOrderByCode(order.code, db)!.status, 'delivery')).toContain(status);
      expect(updateOrderStatus(order.id, status, db)).toBe(true);
    }
    const done = getOrderByCode(order.code, db);
    expect(done?.status).toBe('done');
    expect(done?.events.map((e) => e.status)).toEqual([
      'new',
      'preparing',
      'ready',
      'delivering',
      'done',
    ]);
  });

  it('sends a pickup order straight from ready to handed over', () => {
    expect(nextStatuses('ready', 'pickup')).toEqual(['done', 'cancelled']);
    expect(nextStatuses('ready', 'delivery')).toEqual(['delivering', 'cancelled']);
  });

  it('is a dead end once the order is finished', () => {
    expect(nextStatuses('done', 'delivery')).toEqual([]);
    expect(nextStatuses('cancelled', 'delivery')).toEqual([]);
  });

  it('records no event for a status that did not change', () => {
    const order = place();
    expect(updateOrderStatus(order.id, 'new', db)).toBe(false);
    expect(getOrderByCode(order.code, db)?.events).toHaveLength(1);
  });

  it('keeps finished orders off the kitchen board', () => {
    const staying = place();
    const leaving = place();
    updateOrderStatus(leaving.id, 'preparing', db);
    updateOrderStatus(leaving.id, 'cancelled', db);

    const board = listActiveOrders(db);
    expect(board.map((o) => o.id)).toEqual([staying.id]);
  });
});

describe('dashboardStats', () => {
  it('counts today and averages it', () => {
    place();
    place(2);
    const stats = dashboardStats(7, db);

    expect(stats.todayOrders).toBe(2);
    expect(stats.todayRevenueLbp).toBe(1_000_000 + 1_900_000);
    expect(stats.averageOrderLbp).toBe(1_450_000);
    expect(stats.newOrders).toBe(2);
  });

  it('leaves cancelled orders out of the takings', () => {
    const kept = place();
    const binned = place();
    updateOrderStatus(binned.id, 'cancelled', db);

    const stats = dashboardStats(7, db);
    expect(stats.todayOrders).toBe(1);
    expect(stats.todayRevenueLbp).toBe(kept.totalLbp);
  });

  it('returns a full window with zeroes for the quiet days', () => {
    place();
    const stats = dashboardStats(7, db);
    expect(stats.byDay).toHaveLength(7);
    expect(stats.byDay.slice(0, 6).every((day) => day.orders === 0)).toBe(true);
    expect(stats.byDay[6].orders).toBe(1);
  });

  it('ranks best sellers by quantity', () => {
    place(3);
    const stats = dashboardStats(7, db);
    expect(stats.topItems[0]).toMatchObject({ nameEn: 'Shawarma Meat', qty: 3 });
  });
});
