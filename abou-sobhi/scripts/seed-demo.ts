/**
 * Fills the database with a week of plausible trading so the owner can see the
 * admin panel doing its job before a single real order arrives.
 *
 *   npm run db:demo
 */
import { getDb } from '../lib/db';
import { priceCart } from '../lib/pricing';
import { createOrder, updateOrderStatus } from '../lib/store/orders';
import { getSettings } from '../lib/store/settings';
import { listZones } from '../lib/store/zones';
import { getMenu } from '../lib/store/menu';
import type { CartLineInput, OrderStatus } from '../lib/types';

const NAMES = [
  'خالد طحلة', 'ريم سعادة', 'أحمد المصري', 'جنى حداد', 'محمد الرفاعي',
  'ليلى كرم', 'عمر شهاب', 'نور الدين', 'سارة عيتاني', 'وسيم بركات',
];
const PHONES = ['71123456', '76555111', '03987654', '81445566', '70334455'];
const NOTES = ['', '', '', 'الجرس خربان، دقّ عالتلفون', 'بدون بصل', 'توصيل سريع لو سمحت'];
const STREETS = ['شارع المئتين', 'شارع عزمي', 'التل، جانب الساعة', 'الميناء، الكورنيش'];

/** Deterministic so re-running produces the same shop, not a different one. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const random = makeRandom(20260901);
const pickOne = <T>(list: T[]): T => list[Math.floor(random() * list.length)];

function main(): void {
  const db = getDb();
  const settings = getSettings(db);
  const zones = listZones(db, { activeOnly: true });
  const products = getMenu(db, { activeOnly: true }).categories.flatMap((c) => c.products);

  const existing = db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number };
  if (existing.n > 0) {
    console.log(`Database already has ${existing.n} orders — nothing seeded.`);
    return;
  }

  let placed = 0;
  for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
    const count = 3 + Math.floor(random() * 6);
    for (let i = 0; i < count; i += 1) {
      const placedAt = new Date();
      placedAt.setDate(placedAt.getDate() - daysAgo);
      placedAt.setHours(12 + Math.floor(random() * 10), Math.floor(random() * 60), 0, 0);
      // Today's orders must not be timestamped in the future.
      if (placedAt.getTime() > Date.now()) placedAt.setTime(Date.now() - 60_000);

      const lines: CartLineInput[] = [];
      const lineCount = 1 + Math.floor(random() * 3);
      for (let l = 0; l < lineCount; l += 1) {
        const product = pickOne(products);
        const variant = pickOne(product.variants);
        if (!variant) continue;
        const addons = product.addonSlugs.filter(() => random() < 0.25);
        lines.push({
          productSlug: product.slug,
          variantKind: variant.kind,
          addonSlugs: addons,
          qty: 1 + Math.floor(random() * 2),
          notes: random() < 0.15 ? 'بدون كبيس' : '',
        });
      }
      if (!lines.length) continue;

      const delivery = random() < 0.75;
      const zone = pickOne(zones);
      const priced = priceCart(
        { lines, fulfilment: delivery ? 'delivery' : 'pickup', zoneId: delivery ? zone.id : null },
        db,
        settings,
      );
      if (!priced.ok) continue;

      const order = createOrder(
        {
          cart: priced.cart,
          fulfilment: delivery ? 'delivery' : 'pickup',
          customerName: pickOne(NAMES),
          phone: pickOne(PHONES),
          zoneId: delivery ? zone.id : null,
          street: delivery ? pickOne(STREETS) : '',
          building: delivery ? String(1 + Math.floor(random() * 40)) : '',
          floor: delivery ? String(1 + Math.floor(random() * 8)) : '',
          landmark: '',
          // Scattered around Tripoli so the map pins are not all on one spot.
          lat: delivery ? settings.shopLat + (random() - 0.5) * 0.05 : null,
          lng: delivery ? settings.shopLng + (random() - 0.5) * 0.05 : null,
          notes: pickOne(NOTES),
          payment: random() < 0.2 ? 'cash_usd' : 'cash_lbp',
          usdRate: settings.usdRate,
          locale: 'ar',
          placedAt,
        },
        db,
      );
      placed += 1;

      // Past days are settled; today's orders are left spread across the board.
      const finished: OrderStatus[] = ['preparing', 'ready', 'delivering', 'done'];
      const steps =
        daysAgo > 0
          ? random() < 0.08
            ? (['cancelled'] as OrderStatus[])
            : finished
          : finished.slice(0, Math.floor(random() * 4));
      for (const status of steps) updateOrderStatus(order.id, status, db);
    }
  }

  console.log(`Seeded ${placed} demo orders across the last 7 days.`);
}

main();
