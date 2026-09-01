import { NextResponse, type NextRequest } from 'next/server';
import { isStaffAuthenticated } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { getOrderById, updateOrderStatus } from '@/lib/store/orders';
import { statusSchema } from '@/lib/validation';
import { nextStatuses } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isStaffAuthenticated()) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'bad_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const db = getDb();
  const order = getOrderById(id, db);
  if (!order) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  // Two staff on two phones must not be able to walk an order backwards, so a
  // transition is only accepted if it is legal from where the order is now.
  if (!nextStatuses(order.status, order.fulfilment).includes(parsed.data.status)) {
    return NextResponse.json(
      { ok: false, error: 'illegal_transition', from: order.status },
      { status: 409 },
    );
  }

  updateOrderStatus(id, parsed.data.status, db);
  return NextResponse.json({ ok: true, order: getOrderById(id, db) });
}
