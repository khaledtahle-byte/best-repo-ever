'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { getOrderById, updateOrderStatus } from '@/lib/store/orders';
import { statusSchema } from '@/lib/validation';
import { nextStatuses } from '@/lib/types';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  clearLoginAttempts,
  createSessionToken,
  loginAttemptAllowed,
  recordLoginFailure,
  verifyPassword,
  verifySessionToken,
} from '@/lib/auth';

/** Best-effort client identity for throttling; falls back to a single bucket. */
function clientKey(): string {
  const forwarded = headers().get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || headers().get('x-real-ip') || 'local';
}

export async function signIn(formData: FormData): Promise<void> {
  const key = clientKey();
  if (!loginAttemptAllowed(key)) redirect('/admin/login?error=throttled');

  const password = String(formData.get('password') ?? '');
  if (!verifyPassword(password)) {
    recordLoginFailure(key);
    redirect('/admin/login?error=wrong');
  }

  clearLoginAttempts(key);
  cookies().set(SESSION_COOKIE, createSessionToken(), SESSION_COOKIE_OPTIONS);
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  redirect('/admin/login');
}

export async function updateStatusAction(formData: FormData): Promise<void> {
  if (!verifySessionToken(cookies().get(SESSION_COOKIE)?.value)) redirect('/admin/login');

  const id = Number(formData.get('id'));
  const parsed = statusSchema.safeParse({ status: formData.get('status') });
  if (!Number.isInteger(id) || !parsed.success) return;

  const db = getDb();
  const order = getOrderById(id, db);
  if (!order) return;
  // Same guard as the API route: only a legal next step is accepted.
  if (!nextStatuses(order.status, order.fulfilment).includes(parsed.data.status)) return;

  updateOrderStatus(id, parsed.data.status, db);
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin');
}
