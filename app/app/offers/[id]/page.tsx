import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { requireSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AnalysisResult } from '@/components/analyze/analysis-result';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { OfferAnalysis } from '@/lib/types';

export const metadata: Metadata = { title: 'Analysis' };

export default async function OfferPage({ params }: { params: { id: string } }) {
  const session = await requireSessionContext();
  const supabase = createClient();

  // Row-level security means a missing row and a forbidden row look the same,
  // which is exactly what we want to expose.
  const { data: offer } = await supabase
    .from('offers')
    .select('id, analysis, supplier_name, file_name, source_type, warnings')
    .eq('id', params.id)
    .maybeSingle();

  if (!offer) notFound();

  const analysis = offer.analysis as unknown as OfferAnalysis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app">
            <ArrowLeft className="h-4 w-4" />
            All offers
          </Link>
        </Button>
        {offer.file_name ? (
          <p className="text-sm text-muted-foreground">From {offer.file_name}</p>
        ) : null}
      </div>

      {analysis?.lines ? (
        <AnalysisResult analysis={analysis} offerId={offer.id} canGenerateEmail={session.entitlements.canGenerateEmail} />
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            This record has no stored analysis. Run the offer again to rebuild it.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
