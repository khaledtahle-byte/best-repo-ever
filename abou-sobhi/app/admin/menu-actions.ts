'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isStaffAuthenticated } from '@/lib/auth';
import { getDb } from '@/lib/db';
import {
  repriceAll,
  setAddonActive,
  setAddonPrice,
  setCategoryActive,
  setProductActive,
  setVariantPrice,
} from '@/lib/store/menu';
import { parseLbpInput } from '@/lib/money';

function guard(): void {
  if (!isStaffAuthenticated()) redirect('/admin/login');
}

/** Ids are submitted as hidden fields because unchecked boxes send nothing. */
function idList(formData: FormData, field: string): number[] {
  return String(formData.get(field) ?? '')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export async function saveMenuAction(formData: FormData): Promise<void> {
  guard();
  const db = getDb();

  for (const id of idList(formData, 'category_ids')) {
    setCategoryActive(id, formData.get(`category_active_${id}`) === 'on', db);
  }
  for (const id of idList(formData, 'product_ids')) {
    setProductActive(id, formData.get(`product_active_${id}`) === 'on', db);
  }
  for (const id of idList(formData, 'variant_ids')) {
    const price = parseLbpInput(String(formData.get(`variant_price_${id}`) ?? ''));
    if (price !== null) setVariantPrice(id, price, db);
  }
  for (const id of idList(formData, 'addon_ids')) {
    const price = parseLbpInput(String(formData.get(`addon_price_${id}`) ?? ''));
    if (price !== null) setAddonPrice(id, price, db);
    setAddonActive(id, formData.get(`addon_active_${id}`) === 'on', db);
  }

  revalidatePath('/admin/menu');
  revalidatePath('/');
  redirect('/admin/menu?saved=1');
}

/**
 * When the lira moves, the whole board moves. This is the bulk edit that turns
 * a two-hour reprint into one number and a button.
 */
export async function repriceAction(formData: FormData): Promise<void> {
  guard();
  const percent = Number(formData.get('percent'));
  if (!Number.isFinite(percent) || percent === 0 || percent < -90 || percent > 500) {
    redirect('/admin/menu?error=percent');
  }
  repriceAll(percent, getDb());
  revalidatePath('/admin/menu');
  revalidatePath('/');
  redirect('/admin/menu?saved=1');
}
