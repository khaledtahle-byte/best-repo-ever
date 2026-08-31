import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { handleRouteError, jsonError } from '@/lib/api';
import { settingsRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    const body = settingsRequestSchema.parse(await request.json());
    const supabase = createClient();

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: body.fullName ?? null,
        company_name: body.companyName ?? null,
        cost_of_capital_pct: body.costOfCapitalPct,
        target_margin_pct: body.targetMarginPct,
        default_currency: body.defaultCurrency.toUpperCase(),
      })
      .eq('id', session.user.id)
      .select('*')
      .single();
    if (error) throw error;

    return NextResponse.json({ profile: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
