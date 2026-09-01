/**
 * The schema is embedded rather than read from a .sql file so it survives
 * Next.js's server bundling, where loose files next to the source are not
 * guaranteed to be traced into the deployment output.
 *
 * Money columns are whole Lebanese pounds. Timestamps are UTC ISO strings;
 * `business_day` is the Asia/Beirut calendar day the order belongs to, stored
 * alongside so "today's takings" is an index lookup and never a timezone bug.
 */
export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  slug    TEXT    NOT NULL UNIQUE,
  name_ar TEXT    NOT NULL,
  name_en TEXT    NOT NULL,
  sort    INTEGER NOT NULL DEFAULT 0,
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug        TEXT    NOT NULL UNIQUE,
  name_ar     TEXT    NOT NULL,
  name_en     TEXT    NOT NULL,
  desc_ar     TEXT    NOT NULL DEFAULT '',
  desc_en     TEXT    NOT NULL DEFAULT '',
  addon_slugs TEXT    NOT NULL DEFAULT '[]',
  badge       TEXT    NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, sort);

CREATE TABLE IF NOT EXISTS variants (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,
  price_lbp  INTEGER NOT NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  UNIQUE (product_id, kind)
);

CREATE TABLE IF NOT EXISTS addons (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  slug      TEXT    NOT NULL UNIQUE,
  name_ar   TEXT    NOT NULL,
  name_en   TEXT    NOT NULL,
  price_lbp INTEGER NOT NULL,
  sort      INTEGER NOT NULL DEFAULT 0,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS zones (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT    NOT NULL,
  name_en TEXT    NOT NULL,
  fee_lbp INTEGER NOT NULL DEFAULT 0,
  sort    INTEGER NOT NULL DEFAULT 0,
  active  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT    NOT NULL UNIQUE,
  daily_number     INTEGER NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'new',
  fulfilment       TEXT    NOT NULL,
  customer_name    TEXT    NOT NULL,
  phone            TEXT    NOT NULL,
  zone_id          INTEGER REFERENCES zones(id) ON DELETE SET NULL,
  zone_name_ar     TEXT    NOT NULL DEFAULT '',
  zone_name_en     TEXT    NOT NULL DEFAULT '',
  street           TEXT    NOT NULL DEFAULT '',
  building         TEXT    NOT NULL DEFAULT '',
  floor            TEXT    NOT NULL DEFAULT '',
  landmark         TEXT    NOT NULL DEFAULT '',
  lat              REAL,
  lng              REAL,
  notes            TEXT    NOT NULL DEFAULT '',
  payment          TEXT    NOT NULL DEFAULT 'cash_lbp',
  subtotal_lbp     INTEGER NOT NULL,
  delivery_fee_lbp INTEGER NOT NULL DEFAULT 0,
  total_lbp        INTEGER NOT NULL,
  usd_rate         INTEGER NOT NULL DEFAULT 0,
  locale           TEXT    NOT NULL DEFAULT 'ar',
  business_day     TEXT    NOT NULL,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status, id DESC);
CREATE INDEX IF NOT EXISTS idx_orders_day     ON orders(business_day);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_slug     TEXT    NOT NULL,
  name_ar          TEXT    NOT NULL,
  name_en          TEXT    NOT NULL,
  variant_kind     TEXT    NOT NULL,
  unit_price_lbp   INTEGER NOT NULL,
  addons_json      TEXT    NOT NULL DEFAULT '[]',
  addons_total_lbp INTEGER NOT NULL DEFAULT 0,
  qty              INTEGER NOT NULL,
  line_total_lbp   INTEGER NOT NULL,
  notes            TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status   TEXT    NOT NULL,
  at       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id, id);
`;
