import type { Metadata } from 'next';
import { requireSessionContext } from '@/lib/auth';
import { PageHeader } from '@/components/app/page-header';
import { AnalyzeWorkspace } from '@/components/analyze/analyze-workspace';

export const metadata: Metadata = { title: 'Analyse an offer' };

export default async function AnalyzePage() {
  const session = await requireSessionContext();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analyse an offer"
        description="Upload the quotation, paste the email, or type the lines in. DealGuard works out what each unit really costs once rebates, freight, surcharges and payment terms are priced in."
      />

      <AnalyzeWorkspace
        canAnalyze={session.entitlements.canAnalyze}
        canGenerateEmail={session.entitlements.canGenerateEmail}
        analysesRemaining={session.entitlements.analysesRemaining}
      />
    </div>
  );
}
