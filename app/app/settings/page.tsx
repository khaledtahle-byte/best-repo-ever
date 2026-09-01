import { Suspense } from 'react';
import type { Metadata } from 'next';
import { requireSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app/page-header';
import { BillingPanel } from '@/components/settings/billing-panel';
import { PreferencesForm } from '@/components/settings/preferences-form';
import { ApiKeysPanel } from '@/components/settings/api-keys-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { isStripeConfigured } from '@/lib/supabase/env';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await requireSessionContext();
  const supabase = createClient();

  let seatsUsed: number | null = null;
  if (session.organization) {
    const { count } = await supabase
      .from('organization_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', session.organization.id);
    seatsUsed = count ?? null;
  }

  const planStatus = session.organization?.plan_status ?? session.profile.plan_status;
  const periodEnd = session.organization?.current_period_end ?? session.profile.current_period_end;
  const hasBillingAccount = Boolean(
    session.organization?.stripe_customer_id ?? session.profile.stripe_customer_id,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Your plan, the numbers that drive the analysis, and API access."
      />

      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <BillingPanel
          entitlements={session.entitlements}
          planStatus={planStatus}
          currentPeriodEnd={periodEnd}
          hasBillingAccount={hasBillingAccount}
          seatsUsed={seatsUsed}
          stripeReady={isStripeConfigured()}
        />
      </Suspense>

      <PreferencesForm profile={session.profile} />

      <ApiKeysPanel canUseApi={session.entitlements.canUseApi} />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Signed in as {session.user.email} · joined {formatDate(session.profile.created_at)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            To delete your account and every offer with it, email support@dealguard.app from this
            address.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
