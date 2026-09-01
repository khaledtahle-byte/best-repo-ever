import Link from 'next/link';
import { Check, Minus } from 'lucide-react';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Pricing({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section id="pricing" className="scroll-mt-20 border-b border-border py-20 lg:py-24">
      <div className="container">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            One recovered surcharge pays for the year
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free. Upgrade when the history becomes the point.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const href = signedIn
              ? planId === 'free'
                ? '/app'
                : `/app/settings?upgrade=${planId}`
              : planId === 'free'
                ? '/signup'
                : `/signup?plan=${planId}`;

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-xl border bg-card p-7',
                  plan.highlight ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border',
                )}
              >
                {plan.highlight ? (
                  <Badge className="absolute -top-3 left-7 bg-primary text-primary-foreground">
                    Most popular
                  </Badge>
                ) : null}

                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight">{plan.name}</h3>
                  {plan.seats > 1 ? (
                    <span className="text-xs text-muted-foreground">{plan.seats} seats</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{plan.tagline}</p>

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="tabular text-4xl font-semibold tracking-tight">
                    ${plan.priceMonthly}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.priceMonthly === 0 ? 'forever' : '/month'}
                  </span>
                </p>

                <Button asChild className="mt-6" variant={plan.highlight ? 'default' : 'outline'}>
                  <Link href={href}>{plan.cta}</Link>
                </Button>

                <ul className="mt-7 space-y-3 border-t border-border pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={feature.included ? 'text-foreground/85' : 'text-muted-foreground/60'}>
                        {feature.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          All plans include PDF, CSV, XLSX and paste-in parsing, the full cost breakdown, and
          hidden-cost detection. Cancel any time from your billing settings.
        </p>
      </div>
    </section>
  );
}
