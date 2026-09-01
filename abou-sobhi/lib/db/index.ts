import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema';
import { SEED_ADDONS, SEED_CATEGORIES, SEED_ZONES } from './menu-data';
import { DEFAULT_HOURS } from '../time';

export type Db = Database.Database;

/**
 * Defaults the shop can change from the admin panel. They are written once, on
 * first boot, with INSERT OR IGNORE so an upgrade never clobbers a real value.
 */
export const DEFAULT_SETTINGS: Record<string, string> = {
  store_name_ar: 'أبو صبحي',
  store_name_en: 'Abou Sobhi',
  tagline_ar: 'شاورما طرابلس الأصلية',
  tagline_en: 'Authentic Tripoli shawarma',
  phone: '06431000',
  whatsapp: '76431000',
  address_ar: 'طرابلس، لبنان',
  address_en: 'Tripoli, Lebanon',
  shop_lat: '34.4367',
  shop_lng: '35.8497',
  usd_rate: '89500',
  prep_minutes: '25',
  delivery_minutes: '40',
  min_order_lbp: '600000',
  free_delivery_over_lbp: '4000000',
  accepting_orders: '1',
  hours: JSON.stringify(DEFAULT_HOURS),
};

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH;
  if (configured) return path.resolve(configured);
  return path.join(process.cwd(), 'data', 'abou-sobhi.db');
}

function connect(): Db {
  const file = resolveDbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  seed(db);
  return db;
}

/**
 * Populates an empty database with the printed menu, the delivery zones and the
 * default settings. Idempotent: once `categories` has rows the catalogue is the
 * shop's to manage and is never re-seeded over.
 */
export function seed(db: Db): void {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const writeDefaults = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(key, value);
  });
  writeDefaults();

  const catalogueEmpty =
    (db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }).n === 0;
  if (!catalogueEmpty) return;

  const insertCategory = db.prepare(
    'INSERT INTO categories (slug, name_ar, name_en, sort) VALUES (?, ?, ?, ?)',
  );
  const insertProduct = db.prepare(
    `INSERT INTO products (category_id, slug, name_ar, name_en, desc_ar, desc_en, addon_slugs, badge, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertVariant = db.prepare(
    'INSERT INTO variants (product_id, kind, price_lbp, sort) VALUES (?, ?, ?, ?)',
  );
  const insertAddon = db.prepare(
    'INSERT INTO addons (slug, name_ar, name_en, price_lbp, sort) VALUES (?, ?, ?, ?, ?)',
  );
  const insertZone = db.prepare(
    'INSERT INTO zones (name_ar, name_en, fee_lbp, sort) VALUES (?, ?, ?, ?)',
  );

  const run = db.transaction(() => {
    SEED_ADDONS.forEach((addon, i) => {
      insertAddon.run(addon.slug, addon.nameAr, addon.nameEn, addon.price, i);
    });
    SEED_ZONES.forEach((zone, i) => {
      insertZone.run(zone.nameAr, zone.nameEn, zone.fee, i);
    });
    SEED_CATEGORIES.forEach((category, ci) => {
      const categoryId = Number(
        insertCategory.run(category.slug, category.nameAr, category.nameEn, ci).lastInsertRowid,
      );
      category.products.forEach((product, pi) => {
        const productId = Number(
          insertProduct.run(
            categoryId,
            product.slug,
            product.nameAr,
            product.nameEn,
            product.descAr ?? '',
            product.descEn ?? '',
            JSON.stringify(product.addons ?? []),
            product.badge ?? '',
            pi,
          ).lastInsertRowid,
        );
        product.variants.forEach((variant, vi) => {
          insertVariant.run(productId, variant.kind, variant.price, vi);
        });
      });
    });
  });
  run();
}

/**
 * One connection per process. Next.js reloads modules in dev, so the handle is
 * parked on globalThis to avoid piling up file locks on every edit.
 */
const globalForDb = globalThis as unknown as { __abouSobhiDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__abouSobhiDb) globalForDb.__abouSobhiDb = connect();
  return globalForDb.__abouSobhiDb;
}

/** Fresh in-memory database, used by the tests. */
export function createTestDb(): Db {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  seed(db);
  return db;
}
