'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, CreditCard, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PLANS, PLAN_ORDER, type Entitlements } from '@/lib/plans';
import type { PlanId } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export function BillingPanel({
  entitlements,
  planStatus,
  currentPeriodEnd,
  hasBillingAccount,
  seatsUsed,
  stripeReady,
}: {
  entitlements: Entitlements;
  planStatus: string;
  currentPeriodEnd: string | null;
  hasBillingAccount: boolean;
  seatsUsed: number | null;
  stripeReady: boolean;
}) {
  const params = useSearchParams();
  const [pending, setPending] = useState<PlanId | 'portal' | null>(null);
  const requestedUpgrade = params.get('upgrade');
  const checkout = params.get('checkout');

  useEffect(() => {
    if (checkout === 'success') toast.success('Subscription active — thank you.');
    if (checkout === 'cancelled') toast('Checkout cancelled. Nothing was charged.');
  }, [checkout]);

  async function startCheckout(plan: PlanId) {
    setPending(plan);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Checkout could not be started.');
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Checkout could not be started.');
      setPending(null);
    }
  }

  async function openPortal() {
    setPending('portal');
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The billing portal could not be opened.');
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The billing portal could not be opened.');
      setPending(null);
    }
  }

  return (
    <Card id="billing">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Plan and billing</CardTitle>
            <CardDescription>
              You are on {entitlements.planName}
              {planStatus !== 'active' ? ` (${planStatus.replace('_', ' ')})` : ''}
              {currentPeriodEnd ? ` · renews ${formatDate(currentPeriodEnd)}` : ''}
              {seatsUsed !== null ? ` · ${seatsUsed} of ${entitlements.seats} seats used` : ''}
            </CardDescription>
          </div>
          <Badge variant={entitlements.plan === 'free' ? 'outline' : 'default'}>
            {entitlements.planName}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!stripeReady ? (
          <Alert variant="warning">
            <AlertTitle>Stripe is not configured</AlertTitle>
            <AlertDescription>
              Set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS and
              STRIPE_WEBHOOK_SECRET to enable checkout. See README.md.
            </AlertDescription>
          </Alert>
        ) : null}

        {planStatus === 'past_due' ? (
          <Alert variant="destructive">
            <AlertTitle>Your last payment failed</AlertTitle>
            <AlertDescription>
              Update your card in the billing portal to keep unlimited analyses.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = entitlements.plan === planId;
            const highlighted = requestedUpgrade === planId && !isCurrent;

            return (
              <div
                key={plan.id}
                className={cn(
                  'flex flex-col rounded-lg border p-5',
                  isCurrent ? 'border-primary/60 bg-primary/[0.05]' : 'border-border',
                  highlighted && 'ring-2 ring-primary',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {isCurrent ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Current
                    </Badge>
                  ) : null}
                </div>

                <p className="tabular mt-2 text-2xl font-semibold tracking-tight">
                  ${plan.priceMonthly}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {plan.priceMonthly === 0 ? '' : '/mo'}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>

                <div className="mt-4 flex-1" />

                {isCurrent ? (
                  hasBillingAccount ? (
                    <Button variant="outline" onClick={openPortal} disabled={pending !== null}>
                      {pending === 'portal' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Manage billing
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      No billing needed
                    </Button>
                  )
                ) : planId === 'free' ? (
                  hasBillingAccount ? (
                    <Button variant="ghost" onClick={openPortal} disabled={pending !== null}>
                      Downgrade in portal
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button variant="ghost" disabled>
                      Included
                    </Button>
                  )
                ) : (
                  <Button
                    onClick={() => startCheckout(planId)}
                    disabled={pending !== null || !stripeReady}
                    variant={highlighted || plan.highlight ? 'default' : 'outline'}
                  >
                    {pending === planId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {plan.cta}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Payments are handled by Stripe. DealGuard never sees your card details. Downgrading keeps
          your history — you only lose access to the history views and the email generator.
        </p>
      </CardContent>
    </Card>
  );
}
