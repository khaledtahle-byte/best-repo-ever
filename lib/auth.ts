import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { buildEntitlements, type Entitlements } from '@/lib/plans';
import type { OrganizationRow, ProfileRow } from '@/lib/supabase/types';
import type { PlanId } from '@/lib/types';

export interface SessionContext {
  user: User;
  profile: ProfileRow;
  organization: OrganizationRow | null;
  entitlements: Entitlements;
  /** Set on every row the user creates, so their team can see it. */
  orgId: string | null;
}

/** An organisation plan beats a personal one — Business seats inherit Business. */
export function resolvePlan(profile: ProfileRow | null, organization: OrganizationRow | null): PlanId {
  if (organization && (organization.plan_status === 'active' || organization.plan_status === 'trialing')) {
    return organization.plan;
  }
  if (profile && (profile.plan_status === 'active' || profile.plan_status === 'trialing')) {
    return profile.plan;
  }
  return 'free';
}

/**
 * The signed-in user with everything the app needs to decide what they may do.
 * Cached per request so a page and its children share one round trip.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  // The profile row is created by a trigger on sign-up; if it is missing (an
  // account made before the trigger existed) create it now rather than 500.
  let resolvedProfile = profile;
  if (!resolvedProfile) {
    const { data: created } = await supabase
      .from('profiles')
      .insert({ id: user.id, email: user.email ?? null })
      .select('*')
      .maybeSingle();
    resolvedProfile = created ?? null;
  }
  if (!resolvedProfile) return null;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let organization: OrganizationRow | null = null;
  if (membership?.org_id) {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', membership.org_id)
      .maybeSingle();
    organization = data ?? null;
  }

  const plan = resolvePlan(resolvedProfile, organization);

  const { data: used } = await supabase.rpc('analyses_this_month', { uid: user.id });

  return {
    user,
    profile: resolvedProfile,
    organization,
    orgId: organization?.id ?? resolvedProfile.org_id ?? null,
    entitlements: buildEntitlements(plan, typeof used === 'number' ? used : 0),
  };
});

/** Use in any /app page — middleware already redirects, this is the type guard. */
export async function requireSessionContext(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect('/login');
  return context;
}
