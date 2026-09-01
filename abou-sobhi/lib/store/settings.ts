import type { Db } from '../db';
import { getDb, DEFAULT_SETTINGS } from '../db';
import { parseHours, isOpenAt, type DayHours } from '../time';
import type { StoreSettings } from '../types';

function readAll(db: Db): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string;
    value: string;
  }[];
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function num(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function getSettings(db: Db = getDb()): StoreSettings {
  const raw = readAll(db);
  return {
    storeNameAr: raw.store_name_ar ?? '',
    storeNameEn: raw.store_name_en ?? '',
    taglineAr: raw.tagline_ar ?? '',
    taglineEn: raw.tagline_en ?? '',
    phone: raw.phone ?? '',
    whatsapp: raw.whatsapp ?? '',
    addressAr: raw.address_ar ?? '',
    addressEn: raw.address_en ?? '',
    shopLat: num(raw.shop_lat, 34.4367),
    shopLng: num(raw.shop_lng, 35.8497),
    usdRate: Math.max(0, num(raw.usd_rate, 0)),
    prepMinutes: Math.max(0, num(raw.prep_minutes, 25)),
    deliveryMinutes: Math.max(0, num(raw.delivery_minutes, 40)),
    minOrderLbp: Math.max(0, num(raw.min_order_lbp, 0)),
    freeDeliveryOverLbp: Math.max(0, num(raw.free_delivery_over_lbp, 0)),
    acceptingOrders: raw.accepting_orders !== '0',
    hours: parseHours(raw.hours),
  };
}

export function saveSettings(patch: Record<string, string>, db: Db = getDb()): void {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );
  const run = db.transaction(() => {
    for (const [key, value] of Object.entries(patch)) stmt.run(key, value);
  });
  run();
}

export function saveHours(hours: DayHours[], db: Db = getDb()): void {
  saveSettings({ hours: JSON.stringify(hours) }, db);
}

/**
 * The shop takes orders only when it is both inside its opening hours and the
 * owner has not flipped the kill switch (used when the spit runs out).
 */
export function isShopOpen(settings: StoreSettings, now: Date = new Date()): boolean {
  return settings.acceptingOrders && isOpenAt(settings.hours, now);
}
