import crypto from 'node:crypto';
import type { Db } from '../db';
import { getDb } from '../db';
import { businessDay, recentBusinessDays } from '../time';
import { CODE_ALPHABET, CODE_LENGTH, normaliseCode } from '../order-code';
import type {
  Fulfilment,
  Locale,
  Order,
  OrderEvent,
  OrderItem,
  OrderItemAddon,
  OrderStatus,
  PaymentMethod,
  VariantKind,
} from '../types';
import { OPEN_STATUSES } from '../types';
import type { PricedCart } from '../pricing';

/**
 * The tracking code doubles as the only credential on the tracking page, so it
 * is drawn from a CSPRNG rather than being a sequential number anyone could
 * walk to read a stranger's address.
 */
function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

interface OrderRow {
  id: number;
  code: string;
  daily_number: number;
  status: string;
  fulfilment: string;
  customer_name: string;
  phone: string;
  zone_id: number | null;
  zone_name_ar: string;
  zone_name_en: string;
  street: string;
  building: string;
  floor: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  payment: string;
  subtotal_lbp: number;
  delivery_fee_lbp: number;
  total_lbp: number;
  usd_rate: number;
  locale: string;
  business_day: string;
  created_at: string;
  updated_at: string;
}

interface ItemRow {
  id: number;
  order_id: number;
  product_slug: string;
  name_ar: string;
  name_en: string;
  variant_kind: string;
  unit_price_lbp: number;
  addons_json: string;
  addons_total_lbp: number;
  qty: number;
  line_total_lbp: number;
  notes: string;
}

function parseAddons(raw: string): OrderItemAddon[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OrderItemAddon[]) : [];
  } catch {
    return [];
  }
}

function toItem(row: ItemRow): OrderItem {
  return {
    id: row.id,
    productSlug: row.product_slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    variantKind: row.variant_kind as VariantKind,
    unitPriceLbp: row.unit_price_lbp,
    addons: parseAddons(row.addons_json),
    addonsTotalLbp: row.addons_total_lbp,
    qty: row.qty,
    lineTotalLbp: row.line_total_lbp,
    notes: row.notes,
  };
}

function toOrder(row: OrderRow, items: OrderItem[], events: OrderEvent[]): Order & {
  dailyNumber: number;
} {
  return {
    id: row.id,
    code: row.code,
    dailyNumber: row.daily_number,
    status: row.status as OrderStatus,
    fulfilment: row.fulfilment as Fulfilment,
    customerName: row.customer_name,
    phone: row.phone,
    zoneId: row.zone_id,
    zoneNameAr: row.zone_name_ar,
    zoneNameEn: row.zone_name_en,
    street: row.street,
    building: row.building,
    floor: row.floor,
    landmark: row.landmark,
    lat: row.lat,
    lng: row.lng,
    notes: row.notes,
    payment: row.payment as PaymentMethod,
    subtotalLbp: row.subtotal_lbp,
    deliveryFeeLbp: row.delivery_fee_lbp,
    totalLbp: row.total_lbp,
    usdRate: row.usd_rate,
    locale: (row.locale === 'en' ? 'en' : 'ar') as Locale,
    businessDay: row.business_day,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
    events,
  };
}

export type StoredOrder = Order & { dailyNumber: number };

/** Loads items and status history for a batch of orders in two queries. */
function hydrate(rows: OrderRow[], db: Db): StoredOrder[] {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const itemRows = db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id`)
    .all(...ids) as ItemRow[];
  const eventRows = db
    .prepare(`SELECT order_id, status, at FROM order_events WHERE order_id IN (${placeholders}) ORDER BY id`)
    .all(...ids) as { order_id: number; status: string; at: string }[];

  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const row of itemRows) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push(toItem(row));
    itemsByOrder.set(row.order_id, list);
  }
  const eventsByOrder = new Map<number, OrderEvent[]>();
  for (const row of eventRows) {
    const list = eventsByOrder.get(row.order_id) ?? [];
    list.push({ status: row.status as OrderStatus, at: row.at });
    eventsByOrder.set(row.order_id, list);
  }

  return rows.map((row) =>
    toOrder(row, itemsByOrder.get(row.id) ?? [], eventsByOrder.get(row.id) ?? []),
  );
}

export interface CreateOrderInput {
  cart: PricedCart;
  fulfilment: Fulfilment;
  customerName: string;
  phone: string;
  zoneId: number | null;
  street: string;
  building: string;
  floor: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  payment: PaymentMethod;
  usdRate: number;
  locale: Locale;
  /** Overridable so the demo seeder can backdate a week of trading. */
  placedAt?: Date;
}

export function createOrder(input: CreateOrderInput, db: Db = getDb()): StoredOrder {
  const now = input.placedAt ?? new Date();
  const iso = now.toISOString();
  const day = businessDay(now);

  const insertOrder = db.prepare(`
    INSERT INTO orders (
      code, daily_number, status, fulfilment, customer_name, phone, zone_id,
      zone_name_ar, zone_name_en, street, building, floor, landmark, lat, lng,
      notes, payment, subtotal_lbp, delivery_fee_lbp, total_lbp, usd_rate,
      locale, business_day, created_at, updated_at
    ) VALUES (?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (
      order_id, product_slug, name_ar, name_en, variant_kind, unit_price_lbp,
      addons_json, addons_total_lbp, qty, line_total_lbp, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare('INSERT INTO order_events (order_id, status, at) VALUES (?, ?, ?)');
  const countToday = db.prepare(
    'SELECT COUNT(*) AS n FROM orders WHERE business_day = ?',
  );

  const write = db.transaction((): number => {
    const dailyNumber = (countToday.get(day) as { n: number }).n + 1;

    // A collision is a one-in-a-billion event, but a UNIQUE violation would
    // lose a paying customer's order, so retry rather than propagate.
    let orderId = 0;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = generateCode();
      const taken = db.prepare('SELECT 1 FROM orders WHERE code = ?').get(code);
      if (taken) continue;
      orderId = Number(
        insertOrder.run(
          code,
          dailyNumber,
          input.fulfilment,
          input.customerName,
          input.phone,
          input.zoneId,
          input.cart.zoneNameAr,
          input.cart.zoneNameEn,
          input.street,
          input.building,
          input.floor,
          input.landmark,
          input.lat,
          input.lng,
          input.notes,
          input.payment,
          input.cart.subtotalLbp,
          input.cart.deliveryFeeLbp,
          input.cart.totalLbp,
          Math.round(input.usdRate),
          input.locale,
          day,
          iso,
          iso,
        ).lastInsertRowid,
      );
      break;
    }
    if (!orderId) throw new Error('could not allocate an order code');

    for (const line of input.cart.lines) {
      insertItem.run(
        orderId,
        line.productSlug,
        line.nameAr,
        line.nameEn,
        line.variantKind,
        line.unitPriceLbp,
        JSON.stringify(line.addons),
        line.addonsTotalLbp,
        line.qty,
        line.lineTotalLbp,
        line.notes,
      );
    }
    insertEvent.run(orderId, 'new', iso);
    return orderId;
  });

  const id = write();
  const created = getOrderById(id, db);
  if (!created) throw new Error('order vanished immediately after insert');
  return created;
}

export function getOrderById(id: number, db: Db = getDb()): StoredOrder | null {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
  return row ? (hydrate([row], db)[0] ?? null) : null;
}

export function getOrderByCode(code: string, db: Db = getDb()): StoredOrder | null {
  const row = db
    .prepare('SELECT * FROM orders WHERE code = ?')
    .get(normaliseCode(code)) as OrderRow | undefined;
  return row ? (hydrate([row], db)[0] ?? null) : null;
}

export interface ListOrdersOptions {
  statuses?: OrderStatus[];
  day?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function listOrders(opts: ListOrdersOptions = {}, db: Db = getDb()): StoredOrder[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts.statuses?.length) {
    clauses.push(`status IN (${opts.statuses.map(() => '?').join(',')})`);
    params.push(...opts.statuses);
  }
  if (opts.day) {
    clauses.push('business_day = ?');
    params.push(opts.day);
  }
  if (opts.search) {
    const needle = `%${opts.search.trim()}%`;
    clauses.push('(customer_name LIKE ? OR phone LIKE ? OR code LIKE ?)');
    params.push(needle, needle, `%${normaliseCode(opts.search)}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = db
    .prepare(`SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as OrderRow[];
  return hydrate(rows, db);
}

export function countOrders(opts: ListOrdersOptions = {}, db: Db = getDb()): number {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.statuses?.length) {
    clauses.push(`status IN (${opts.statuses.map(() => '?').join(',')})`);
    params.push(...opts.statuses);
  }
  if (opts.day) {
    clauses.push('business_day = ?');
    params.push(opts.day);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return (db.prepare(`SELECT COUNT(*) AS n FROM orders ${where}`).get(...params) as { n: number }).n;
}

/** The kitchen board: everything not yet delivered or cancelled, oldest first. */
export function listActiveOrders(db: Db = getDb()): StoredOrder[] {
  const rows = db
    .prepare(
      `SELECT * FROM orders WHERE status IN (${OPEN_STATUSES.map(() => '?').join(',')}) ORDER BY id ASC`,
    )
    .all(...OPEN_STATUSES) as OrderRow[];
  return hydrate(rows, db);
}

export function updateOrderStatus(id: number, status: OrderStatus, db: Db = getDb()): boolean {
  const iso = new Date().toISOString();
  const run = db.transaction(() => {
    const changed = db
      .prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status != ?')
      .run(status, iso, id, status).changes;
    if (changed) db.prepare('INSERT INTO order_events (order_id, status, at) VALUES (?, ?, ?)').run(id, status, iso);
    return changed > 0;
  });
  return run();
}

export interface DayStats {
  day: string;
  orders: number;
  revenueLbp: number;
}

export interface DashboardStats {
  todayOrders: number;
  todayRevenueLbp: number;
  averageOrderLbp: number;
  activeOrders: number;
  newOrders: number;
  byDay: DayStats[];
  topItems: { nameAr: string; nameEn: string; qty: number; revenueLbp: number }[];
}

/**
 * Cancelled orders are excluded from every money figure — a cancelled order
 * never earned anything and counting it inflates the day's takings.
 */
export function dashboardStats(days = 7, db: Db = getDb()): DashboardStats {
  const today = businessDay();
  const window = recentBusinessDays(days);
  const from = window[0];

  const todayRow = db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_lbp), 0) AS revenue
       FROM orders WHERE business_day = ? AND status != 'cancelled'`,
    )
    .get(today) as { n: number; revenue: number };

  const activeRow = db
    .prepare(
      `SELECT COUNT(*) AS n FROM orders WHERE status IN (${OPEN_STATUSES.map(() => '?').join(',')})`,
    )
    .get(...OPEN_STATUSES) as { n: number };

  const newRow = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'")
    .get() as { n: number };

  const dayRows = db
    .prepare(
      `SELECT business_day AS day, COUNT(*) AS orders, COALESCE(SUM(total_lbp), 0) AS revenue
       FROM orders WHERE business_day >= ? AND status != 'cancelled'
       GROUP BY business_day`,
    )
    .all(from) as { day: string; orders: number; revenue: number }[];
  const byDayMap = new Map(dayRows.map((r) => [r.day, r]));

  const topItems = db
    .prepare(
      `SELECT i.name_ar, i.name_en, SUM(i.qty) AS qty, SUM(i.line_total_lbp) AS revenue
       FROM order_items i JOIN orders o ON o.id = i.order_id
       WHERE o.business_day >= ? AND o.status != 'cancelled'
       GROUP BY i.name_ar, i.name_en
       ORDER BY qty DESC LIMIT 8`,
    )
    .all(from) as { name_ar: string; name_en: string; qty: number; revenue: number }[];

  return {
    todayOrders: todayRow.n,
    todayRevenueLbp: todayRow.revenue,
    averageOrderLbp: todayRow.n ? Math.round(todayRow.revenue / todayRow.n) : 0,
    activeOrders: activeRow.n,
    newOrders: newRow.n,
    byDay: window.map((day) => ({
      day,
      orders: byDayMap.get(day)?.orders ?? 0,
      revenueLbp: byDayMap.get(day)?.revenue ?? 0,
    })),
    topItems: topItems.map((r) => ({
      nameAr: r.name_ar,
      nameEn: r.name_en,
      qty: r.qty,
      revenueLbp: r.revenue,
    })),
  };
}
