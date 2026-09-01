import { NextResponse } from 'next/server';
import { isStaffAuthenticated } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { dashboardStats, listActiveOrders } from '@/lib/store/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Feeds the kitchen board's poll: everything still in progress, plus the day's numbers. */
export function GET() {
  if (!isStaffAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  const db = getDb();
  return NextResponse.json(
    {
      ok: true,
      orders: listActiveOrders(db),
      stats: dashboardStats(7, db),
      at: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
