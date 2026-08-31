import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePlan } from '@/lib/auth';
import type { OrganizationRow, ProfileRow } from '@/lib/supabase/types';
import type { PlanId } from '@/lib/types';

const PREFIX = 'dg_';

export interface GeneratedKey {
  /** Shown once, never stored. */
  secret: string;
  hash: string;
  prefix: string;
}

export function generateApiKey(): GeneratedKey {
  const secret = `${PREFIX}${randomBytes(24).toString('base64url')}`;
  return { secret, hash: hashApiKey(secret), prefix: secret.slice(0, 11) };
}

export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Constant-time compare so a wrong key cannot be found by timing the response. */
export function keysMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface ApiKeyContext {
  keyId: string;
  ownerId: string;
  orgId: string | null;
  plan: PlanId;
  profile: ProfileRow;
}

/**
 * Authenticates a request made with an API key rather than a session cookie.
 * Runs with the service role, so it re-checks the plan itself.
 */
export async function authenticateApiKey(header: string | null): Promise<ApiKeyContext | null> {
  if (!header) return null;
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!token.startsWith(PREFIX) || token.length < 20) return null;

  const admin = createAdminClient();
  const hash = hashApiKey(token);

  const { data: key } = await admin
    .from('api_keys')
    .select('*')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .maybeSingle();

  if (!key || !keysMatch(key.key_hash, hash)) return null;

  const { data: profile } = await admin.from('profiles').select('*').eq('id', key.owner_id).maybeSingle();
  if (!profile) return null;

  let organization: OrganizationRow | null = null;
  if (key.org_id) {
    const { data } = await admin.from('organizations').select('*').eq('id', key.org_id).maybeSingle();
    organization = data ?? null;
  }

  // Best-effort; a failed timestamp update must not fail the request.
  await admin.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);

  return {
    keyId: key.id,
    ownerId: key.owner_id,
    orgId: key.org_id,
    plan: resolvePlan(profile, organization),
    profile,
  };
}
