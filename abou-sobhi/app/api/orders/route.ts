import { NextResponse, type NextRequest } from 'next/server';
import { checkoutSchema } from '@/lib/validation';
import { priceCart } from '@/lib/pricing';
import { createOrder } from '@/lib/store/orders';
import { getSettings, isShopOpen } from '@/lib/store/settings';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(code: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: { code, ...extra } }, { status });
}

/**
 * The one write path a customer can reach. Everything the browser sends is
 * treated as a request, not a fact: prices, fees and totals are all recomputed
 * from the database before a single row is written.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('invalid', 400);
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(first?.message === 'invalid_phone' ? 'invalid' : 'invalid', 400, {
      field: first?.path.join('.') ?? '',
    });
  }
  const input = parsed.data;

  const db = getDb();
  const settings = getSettings(db);
  if (!isShopOpen(settings)) return fail('shop_closed', 409);

  const priced = priceCart(
    { lines: input.lines, fulfilment: input.fulfilment, zoneId: input.zoneId },
    db,
    settings,
  );
  if (!priced.ok) {
    const { error } = priced;
    const status = error.code === 'below_minimum' ? 422 : 409;
    return fail(error.code, status, error);
  }

  try {
    const order = createOrder(
      {
        cart: priced.cart,
        fulfilment: input.fulfilment,
        customerName: input.customerName,
        phone: input.phone,
        zoneId: input.fulfilment === 'delivery' ? input.zoneId : null,
        street: input.street,
        building: input.building,
        floor: input.floor,
        landmark: input.landmark,
        lat: input.lat,
        lng: input.lng,
        notes: input.notes,
        payment: input.payment,
        usdRate: settings.usdRate,
        locale: input.locale,
      },
      db,
    );
    return NextResponse.json({ ok: true, code: order.code }, { status: 201 });
  } catch {
    return fail('server', 500);
  }
}
