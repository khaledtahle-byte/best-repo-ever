import { CircleCheck, CircleDollarSign, Info, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { Flag, FlagSeverity } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEVERITY: Record<FlagSeverity, { icon: typeof Info; className: string; label: string }> = {
  critical: { icon: ShieldAlert, className: 'text-bad', label: 'Critical' },
  warning: { icon: TriangleAlert, className: 'text-review', label: 'Warning' },
  info: { icon: Info, className: 'text-primary', label: 'Note' },
  positive: { icon: CircleCheck, className: 'text-good', label: 'Good' },
};

export function FlagList({ flags, currency }: { flags: Flag[]; currency: string }) {
  if (flags.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-good/30 bg-good/[0.07] px-4 py-4">
            <CircleCheck className="h-5 w-5 shrink-0 text-good" />
            <p className="text-sm">
              Nothing to flag. No hidden charges, no unreachable rebates, and nothing priced above your
              history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Findings</CardTitle>
        <CardDescription>
          {flags.length} {flags.length === 1 ? 'item' : 'items'}, most consequential first.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <ul className="divide-y divide-border/70">
          {flags.map((flag, index) => {
            const config = SEVERITY[flag.severity];
            const Icon = config.icon;

            return (
              <li key={`${flag.code}-${flag.lineIndex ?? 'order'}-${index}`} className="flex gap-4 px-6 py-4">
                <span className={cn('mt-0.5 shrink-0', config.className)}>
                  <Icon className="h-4.5 w-4.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium leading-snug">{flag.title}</p>
                    {flag.impactAmount && flag.impactAmount > 0 ? (
                      <span
                        className={cn(
                          'tabular inline-flex shrink-0 items-center gap-1 text-sm font-medium',
                          flag.severity === 'positive' ? 'text-good' : config.className,
                        )}
                      >
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        {formatCurrency(flag.impactAmount, currency)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{flag.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
