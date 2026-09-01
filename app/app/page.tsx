import Link from 'next/link';
import type { Metadata } from 'next';
import { FileSearch, PiggyBank, ShieldAlert, TrendingDown, Upload } from 'lucide-react';
import { requireSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDashboardStats, listOffers } from '@/lib/queries';
import { PageHeader } from '@/components/app/page-header';
import { StatCard } from '@/components/app/stat-card';
import { EmptyState } from '@/components/app/empty-state';
import { OffersTable } from '@/components/app/offers-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCompactCurrency, formatNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await requireSessionContext();
  const supabase = createClient();

  const [offers, stats] = await Promise.all([
    listOffers(supabase, session.user.id, session.orgId, 25),
    getDashboardStats(supabase, session.user.id, session.orgId),
  ]);

  const currency = offers[0]?.currency ?? session.profile.default_currency ?? 'USD';
  const outOfQuota = !session.entitlements.canAnalyze;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${session.profile.full_name ? `, ${session.profile.full_name.split(' ')[0]}` : ''}`}
        description="Every offer you have analysed, and what it is worth going back to the supplier about."
        actions={
          <Button asChild>
            <Link href="/app/analyze">
              <Upload className="h-4 w-4" />
              Analyse an offer
            </Link>
          </Button>
        }
      />

      {outOfQuota ? (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>You have used all {session.entitlements.analysesLimit} analyses this month</AlertTitle>
          <AlertDescription className="mt-1">
            Your history stays intact.{' '}
            <Link href="/app/settings" className="text-primary hover:underline">
              Upgrade to Pro
            </Link>{' '}
            for unlimited analyses, price history and the counter-offer email generator.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Identified savings"
          value={formatCompactCurrency(stats.savingsIdentified, currency)}
          hint="Across every offer analysed"
          tone="primary"
          icon={PiggyBank}
        />
        <StatCard
          label="Offers analysed"
          value={formatNumber(stats.totalOffers)}
          hint={`${stats.analyzedThisMonth} this month`}
          icon={FileSearch}
        />
        <StatCard
          label="Need a conversation"
          value={formatNumber(stats.badDeals + stats.reviewDeals)}
          hint={`${stats.badDeals} bad · ${stats.reviewDeals} to review`}
          tone={stats.badDeals > 0 ? 'bad' : stats.reviewDeals > 0 ? 'review' : 'default'}
          icon={TrendingDown}
        />
        <StatCard
          label="Suppliers tracked"
          value={formatNumber(stats.suppliers)}
          hint="With price history"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent offers</CardTitle>
          {offers.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/suppliers">By supplier</Link>
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className={offers.length > 0 ? 'p-0' : undefined}>
          {offers.length === 0 ? (
            <EmptyState
              icon={FileSearch}
              title="No offers analysed yet"
              description="Upload a supplier quotation, price list or pasted email. DealGuard will work out the true cost per unit and tell you what to push back on."
              action={
                <Button asChild>
                  <Link href="/app/analyze">
                    <Upload className="h-4 w-4" />
                    Analyse your first offer
                  </Link>
                </Button>
              }
              className="border-0"
            />
          ) : (
            <OffersTable offers={offers} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
