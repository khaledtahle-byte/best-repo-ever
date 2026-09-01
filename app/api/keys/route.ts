import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateApiKey } from '@/lib/api-keys';
import { handleRouteError, jsonError } from '@/lib/api';
import { apiKeyRequestSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    const supabase = createClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, revoked_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ keys: data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    if (!session.entitlements.canUseApi) {
      return jsonError('API access is part of the Business plan.', 402, { code: 'upgrade_required' });
    }

    const { name } = apiKeyRequestSchema.parse(await request.json().catch(() => ({})));
    const generated = generateApiKey();

    // Written with the service role: the hash must never be readable by the
    // browser client, even for its own rows.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('api_keys')
      .insert({
        owner_id: session.user.id,
        org_id: session.orgId,
        name,
        key_hash: generated.hash,
        key_prefix: generated.prefix,
      })
      .select('id, name, key_prefix, created_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ key: data, secret: generated.secret }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return jsonError('Which key should be revoked?', 400);

    const supabase = createClient();
    const { error } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', session.user.id);
    if (error) throw error;

    return NextResponse.json({ revoked: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
