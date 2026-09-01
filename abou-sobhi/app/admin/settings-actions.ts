'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isStaffAuthenticated } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { saveSettings } from '@/lib/store/settings';
import { createZone, deleteZone, updateZone } from '@/lib/store/zones';
import { parseLbpInput } from '@/lib/money';
import type { DayHours } from '@/lib/types';

function guard(): void {
  if (!isStaffAuthenticated()) redirect('/admin/login');
}

const text = (formData: FormData, field: string, max = 200): string =>
  String(formData.get(field) ?? '').trim().slice(0, max);

function money(formData: FormData, field: string, fallback: number): string {
  const parsed = parseLbpInput(String(formData.get(field) ?? ''));
  return String(parsed ?? fallback);
}

/** Whole-number settings: prep time, delivery time. */
function clampInt(raw: FormDataEntryValue | null, min: number, max: number, fallback: number): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return String(fallback);
  return String(Math.min(max, Math.max(min, Math.round(value))));
}

/** Coordinates must keep their decimals — rounding one moves the shop ~100km. */
function clampCoord(raw: FormDataEntryValue | null, limit: number, fallback: number): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return String(fallback);
  return String(Math.min(limit, Math.max(-limit, value)));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveSettingsAction(formData: FormData): Promise<void> {
  guard();

  const hours: DayHours[] = Array.from({ length: 7 }, (_unused, index) => {
    const open = text(formData, `open_${index}`, 5);
    const close = text(formData, `close_${index}`, 5);
    return {
      open: HHMM.test(open) ? open : '11:00',
      close: HHMM.test(close) ? close : '02:00',
      closed: formData.get(`closed_${index}`) === 'on',
    };
  });

  saveSettings(
    {
      store_name_ar: text(formData, 'store_name_ar', 60),
      store_name_en: text(formData, 'store_name_en', 60),
      tagline_ar: text(formData, 'tagline_ar', 80),
      tagline_en: text(formData, 'tagline_en', 80),
      phone: text(formData, 'phone', 24),
      whatsapp: text(formData, 'whatsapp', 24),
      address_ar: text(formData, 'address_ar', 160),
      address_en: text(formData, 'address_en', 160),
      shop_lat: clampCoord(formData.get('shop_lat'), 90, 34.4367),
      shop_lng: clampCoord(formData.get('shop_lng'), 180, 35.8497),
      usd_rate: money(formData, 'usd_rate', 0),
      prep_minutes: clampInt(formData.get('prep_minutes'), 0, 240, 25),
      delivery_minutes: clampInt(formData.get('delivery_minutes'), 0, 240, 40),
      min_order_lbp: money(formData, 'min_order_lbp', 0),
      free_delivery_over_lbp: money(formData, 'free_delivery_over_lbp', 0),
      accepting_orders: formData.get('accepting_orders') === 'on' ? '1' : '0',
      hours: JSON.stringify(hours),
    },
    getDb(),
  );

  revalidatePath('/admin/settings');
  revalidatePath('/');
  redirect('/admin/settings?saved=1');
}

/** Edits, adds and retires delivery areas in one submit. */
export async function saveZonesAction(formData: FormData): Promise<void> {
  guard();
  const db = getDb();

  const ids = String(formData.get('zone_ids') ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  for (const id of ids) {
    if (formData.get(`zone_delete_${id}`) === 'on') {
      deleteZone(id, db);
      continue;
    }
    updateZone(
      id,
      {
        nameAr: text(formData, `zone_name_ar_${id}`, 60),
        nameEn: text(formData, `zone_name_en_${id}`, 60),
        feeLbp: parseLbpInput(String(formData.get(`zone_fee_${id}`) ?? '')) ?? 0,
      },
      db,
    );
  }

  const newNameAr = text(formData, 'new_zone_name_ar', 60);
  const newNameEn = text(formData, 'new_zone_name_en', 60);
  if (newNameAr || newNameEn) {
    createZone(
      {
        nameAr: newNameAr || newNameEn,
        nameEn: newNameEn || newNameAr,
        feeLbp: parseLbpInput(String(formData.get('new_zone_fee') ?? '')) ?? 0,
      },
      db,
    );
  }

  revalidatePath('/admin/settings');
  revalidatePath('/');
  redirect('/admin/settings?saved=1');
}
