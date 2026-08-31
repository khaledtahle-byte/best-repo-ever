import { ArrowRight } from 'lucide-react';
import { analyzeOffer } from '@/lib/analysis/engine';
import { sampleHistory, sampleOffer } from '@/lib/sample-offer';
import { formatCurrency, formatPercent, formatUnitPrice } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * The hero visual is a real analysis: these figures are produced by the same
 * engine that runs on an upload, so the marketing page can never drift away
 * from what the product actually says.
 */
export function SampleBreakdown() {
  const analysis = analyzeOffer(sampleOffer(), sampleHistory(), { costOfCapitalPct: 12 });
  const line = analysis.lines[0];
  const currency = analysis.currency;

  const rows = [
    { label: 'Quoted list price', value: line.listUnitCost, muted: true },
    { label: `Less ${formatPercent(line.headlineDiscountPct)} discount`, value: line.invoiceSubtotal / line.unitsTotal },
    { label: 'Plus freight and fuel surcharge', value: line.invoiceUnitCost, tone: 'up' as const },
    { label: 'Less rebate and payment terms', value: line.trueNetUnitCost, tone: 'down' as const },
  ];

  return (
    <div className="w-full rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{line.description}</p>
          <p className="text-xs text-muted-foreground">
            {analysis.supplierName} · quote {analysis.reference}
          </p>
        </div>
        <Badge variant={analysis.verdict === 'good' ? 'good' : analysis.verdict === 'review' ? 'review' : 'bad'}>
          {analysis.verdict === 'good' ? 'Good deal' : analysis.verdict === 'review' ? 'Review' : 'Bad deal'}
        </Badge>
      </div>

      <div className="divide-y divide-border/70">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3">
            <span className={cn('text-sm', row.muted ? 'text-muted-foreground' : 'text-foreground/85')}>
              {row.label}
            </span>
            <span
              className={cn(
                'tabular text-sm font-medium',
                row.tone === 'up' && 'text-review',
                row.tone === 'down' && 'text-good',
              )}
            >
              {formatUnitPrice(row.value, currency)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-secondary/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            True net cost per {line.uom}
          </p>
          <p className="tabular text-2xl font-semibold tracking-tight">
            {formatUnitPrice(line.trueNetUnitCost, currency)}
          </p>
        </div>
        {line.benchmark ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="tabular text-muted-foreground">
              {formatUnitPrice(line.benchmark.unitCost, currency)}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={cn(
                'tabular font-medium',
                line.benchmark.deltaPct > 0 ? 'text-bad' : 'text-good',
              )}
            >
              {line.benchmark.deltaPct > 0 ? '+' : ''}
              {line.benchmark.deltaPct.toFixed(1)}% vs your last order
            </span>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border px-5 py-4">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Flagged on this order</p>
        <ul className="mt-2 space-y-1.5">
          {analysis.flags.slice(0, 3).map((flag, index) => (
            <li key={`${flag.code}-${index}`} className="flex items-start gap-2 text-sm text-foreground/85">
              <span
                className={cn(
                  'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                  flag.severity === 'critical' && 'bg-bad',
                  flag.severity === 'warning' && 'bg-review',
                  flag.severity === 'info' && 'bg-primary',
                  flag.severity === 'positive' && 'bg-good',
                )}
              />
              <span className="leading-snug">{flag.title}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          <span className="text-muted-foreground">Recoverable on this order: </span>
          <span className="tabular font-semibold text-primary">
            {formatCurrency(analysis.savingsIdentified, currency)}
          </span>
        </p>
      </div>
    </div>
  );
}
