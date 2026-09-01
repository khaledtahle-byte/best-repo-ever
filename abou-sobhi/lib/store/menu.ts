import type { Db } from '../db';
import { getDb } from '../db';
import type { Addon, Category, Menu, Product, Variant, VariantKind } from '../types';

interface CategoryRow {
  id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  sort: number;
  active: number;
}
interface ProductRow {
  id: number;
  category_id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  desc_ar: string;
  desc_en: string;
  addon_slugs: string;
  badge: string;
  sort: number;
  active: number;
}
interface VariantRow {
  id: number;
  product_id: number;
  kind: string;
  price_lbp: number;
  sort: number;
  active: number;
}
interface AddonRow {
  id: number;
  slug: string;
  name_ar: string;
  name_en: string;
  price_lbp: number;
  sort: number;
  active: number;
}

function parseAddonSlugs(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Loads the whole catalogue in three queries and stitches it in memory. The
 * menu is twenty items — a join-per-product would be more code and slower.
 *
 * `activeOnly` is what the storefront asks for; the admin panel wants
 * everything so it can switch sold-out items back on.
 */
export function getMenu(db: Db = getDb(), opts: { activeOnly?: boolean } = {}): Menu {
  const activeOnly = opts.activeOnly ?? false;

  const categoryRows = db
    .prepare(`SELECT * FROM categories ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, id`)
    .all() as CategoryRow[];
  const productRows = db
    .prepare(`SELECT * FROM products ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, id`)
    .all() as ProductRow[];
  const variantRows = db
    .prepare(`SELECT * FROM variants ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, id`)
    .all() as VariantRow[];
  const addonRows = db
    .prepare(`SELECT * FROM addons ${activeOnly ? 'WHERE active = 1' : ''} ORDER BY sort, id`)
    .all() as AddonRow[];

  const variantsByProduct = new Map<number, Variant[]>();
  for (const row of variantRows) {
    const list = variantsByProduct.get(row.product_id) ?? [];
    list.push({
      id: row.id,
      kind: row.kind as VariantKind,
      priceLbp: row.price_lbp,
      active: row.active === 1,
    });
    variantsByProduct.set(row.product_id, list);
  }

  const categoryById = new Map<number, CategoryRow>(categoryRows.map((c) => [c.id, c]));
  const productsByCategory = new Map<number, Product[]>();
  for (const row of productRows) {
    const category = categoryById.get(row.category_id);
    if (!category) continue;
    const list = productsByCategory.get(row.category_id) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      categorySlug: category.slug,
      nameAr: row.name_ar,
      nameEn: row.name_en,
      descAr: row.desc_ar,
      descEn: row.desc_en,
      badge: row.badge,
      active: row.active === 1,
      addonSlugs: parseAddonSlugs(row.addon_slugs),
      variants: variantsByProduct.get(row.id) ?? [],
    });
    productsByCategory.set(row.category_id, list);
  }

  const categories: Category[] = categoryRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    active: row.active === 1,
    products: productsByCategory.get(row.id) ?? [],
  }));

  const addons: Addon[] = addonRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    priceLbp: row.price_lbp,
    active: row.active === 1,
  }));

  // A category with nothing sellable in it is noise on the storefront.
  return {
    categories: activeOnly ? categories.filter((c) => c.products.length > 0) : categories,
    addons,
  };
}

export function setProductActive(productId: number, active: boolean, db: Db = getDb()): void {
  db.prepare('UPDATE products SET active = ? WHERE id = ?').run(active ? 1 : 0, productId);
}

export function setVariantPrice(variantId: number, priceLbp: number, db: Db = getDb()): void {
  db.prepare('UPDATE variants SET price_lbp = ? WHERE id = ?').run(
    Math.max(0, Math.round(priceLbp)),
    variantId,
  );
}

export function setVariantActive(variantId: number, active: boolean, db: Db = getDb()): void {
  db.prepare('UPDATE variants SET active = ? WHERE id = ?').run(active ? 1 : 0, variantId);
}

export function setAddonPrice(addonId: number, priceLbp: number, db: Db = getDb()): void {
  db.prepare('UPDATE addons SET price_lbp = ? WHERE id = ?').run(
    Math.max(0, Math.round(priceLbp)),
    addonId,
  );
}

export function setAddonActive(addonId: number, active: boolean, db: Db = getDb()): void {
  db.prepare('UPDATE addons SET active = ? WHERE id = ?').run(active ? 1 : 0, addonId);
}

export function setCategoryActive(categoryId: number, active: boolean, db: Db = getDb()): void {
  db.prepare('UPDATE categories SET active = ? WHERE id = ?').run(active ? 1 : 0, categoryId);
}

/**
 * Bumps every price in the catalogue by a percentage — the one bulk edit a
 * Lebanese shop actually needs, because when the lira moves the whole board
 * moves with it. Results are rounded to the nearest 50,000 L.L. so the menu
 * keeps printable numbers instead of 637,412.
 */
export function repriceAll(percent: number, db: Db = getDb()): number {
  const factor = 1 + percent / 100;
  if (!Number.isFinite(factor) || factor <= 0) return 0;
  const round = (value: number) => Math.max(50_000, Math.round((value * factor) / 50_000) * 50_000);

  const variants = db.prepare('SELECT id, price_lbp FROM variants').all() as {
    id: number;
    price_lbp: number;
  }[];
  const addons = db.prepare('SELECT id, price_lbp FROM addons').all() as {
    id: number;
    price_lbp: number;
  }[];

  const updateVariant = db.prepare('UPDATE variants SET price_lbp = ? WHERE id = ?');
  const updateAddon = db.prepare('UPDATE addons SET price_lbp = ? WHERE id = ?');
  const run = db.transaction(() => {
    for (const v of variants) updateVariant.run(round(v.price_lbp), v.id);
    for (const a of addons) updateAddon.run(round(a.price_lbp), a.id);
  });
  run();
  return variants.length + addons.length;
}
