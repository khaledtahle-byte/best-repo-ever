import type { OfferAnalysis } from '@/lib/types';
import { VerdictBanner } from '@/components/analyze/verdict-banner';
import { CostBreakdownTable, CostWaterfall } from '@/components/analyze/cost-breakdown-table';
import { FlagList } from '@/components/analyze/flag-list';
import { TermsPanel } from '@/components/analyze/terms-panel';
import { CounterOfferPanel } from '@/components/analyze/counter-offer-panel';

export function AnalysisResult({
  analysis,
  offerId,
  canGenerateEmail,
  usedHistory,
}: {
  analysis: OfferAnalysis;
  offerId: string | null;
  canGenerateEmail: boolean;
  usedHistory?: boolean;
}) {
  return (
    <div className="space-y-6">
      <VerdictBanner analysis={analysis} />

      {/* The line table carries the most columns, so it gets the full row; the
          two summary panels read fine at half width. */}
      <CostBreakdownTable analysis={analysis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CostWaterfall analysis={analysis} />
        <TermsPanel analysis={analysis} />
      </div>

      <FlagList flags={analysis.flags} currency={analysis.currency} />

      <CounterOfferPanel
        offerId={offerId}
        asks={analysis.asks}
        currency={analysis.currency}
        canGenerate={canGenerateEmail}
      />

      {usedHistory === false ? (
        <p className="text-center text-xs text-muted-foreground">
          This is your first analysis for these products. From the next one, DealGuard will compare
          against what you paid here.
        </p>
      ) : null}
    </div>
  );
}
