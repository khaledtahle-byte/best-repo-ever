import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { OfferAnalysis } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const STYLES = {
  good: { border: 'border-good/40', bg: 'bg-good/[0.07]', text: 'text-good', icon: CircleCheck, label: 'Good deal' },
  review: { border: 'border-review/40', bg: 'bg-review/[0.07]', text: 'text-review', icon: TriangleAlert, label: 'Review before signing' },
  bad: { border: 'border-bad/40', bg: 'bg-bad/[0.07]', text: 'text-bad', icon: ShieldAlert, label: 'Bad deal' },
} as const;

export function VerdictBanner({ analysis }: { analysis: OfferAnalysis }) {
  const style = STYLES[analysis.verdict];
  const Icon = style.icon;

  return (
    <section
      className={cn('rounded-xl border p-6 sm:p-7', style.border, style.bg)}
      aria-label={`Verdict: ${style.label}`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <span className={cn('mt-0.5 shrink-0', style.text)}>
            <Icon className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className={cn('text-xl font-semibold tracking-tight', style.text)}>{style.label}</h2>
              <span className="tabular text-sm text-muted-foreground">Score {analysis.score}/100</span>
            </div>
            <p className="mt-2 text-base font-medium">{analysis.headline}</p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {analysis.summary}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {analysis.supplierName}
              {analysis.reference ? ` · ${analysis.reference}` : ''} · quoted {formatDate(analysis.quotedAt)}
            </p>
          </div>
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 lg:text-right">
          <div className="lg:col-start-1">
            <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              True net total
            </dt>
            <dd className="tabular mt-1 text-2xl font-semibold tracking-tight">
              {formatCurrency(analysis.totals.netTotal, analysis.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              On the table
            </dt>
            <dd className={cn('tabular mt-1 text-2xl font-semibold tracking-tight', style.text)}>
              {formatCurrency(analysis.savingsIdentified, analysis.currency)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
