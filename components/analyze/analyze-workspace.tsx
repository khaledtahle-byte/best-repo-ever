'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CircleAlert, Loader2, RotateCcw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { OfferAnalysis, OfferInput, ParseResult, ParseWarning, SourceType } from '@/lib/types';
import { UploadPanel } from '@/components/analyze/upload-panel';
import { OfferEditor, draftFromOffer, draftToOffer, type OfferDraft } from '@/components/analyze/offer-editor';
import { AnalysisResult } from '@/components/analyze/analysis-result';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { sampleOffer } from '@/lib/sample-offer';

type Stage = 'input' | 'review' | 'result';

export function AnalyzeWorkspace({
  canAnalyze,
  canGenerateEmail,
  analysesRemaining,
}: {
  canAnalyze: boolean;
  canGenerateEmail: boolean;
  analysesRemaining: number | null;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('input');
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<OfferDraft>(() => draftFromOffer(null));
  const [warnings, setWarnings] = useState<ParseWarning[]>([]);
  const [source, setSource] = useState<{ type: SourceType; fileName: string | null; text: string | null }>({
    type: 'manual',
    fileName: null,
    text: null,
  });
  const [result, setResult] = useState<{ analysis: OfferAnalysis; offerId: string; usedHistory: boolean } | null>(
    null,
  );

  function applyParse(parsed: ParseResult & { fileName?: string | null }, fallbackType: SourceType) {
    setWarnings(parsed.warnings ?? []);
    setSource({
      type: parsed.sourceType ?? fallbackType,
      fileName: parsed.fileName ?? null,
      text: parsed.text ?? null,
    });
    setDraft(draftFromOffer(parsed.offer));
    setStage('review');

    if (parsed.ok) {
      const count = parsed.offer?.lines.length ?? 0;
      toast.success(`Read ${count} line ${count === 1 ? 'item' : 'items'}`);
    }
  }

  async function parseFile(file: File) {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/parse', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'That file could not be read.');
      applyParse(data, 'manual');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function parseText(text: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'That text could not be read.');
      applyParse(data, 'text');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'That text could not be read.');
    } finally {
      setBusy(false);
    }
  }

  function startManual() {
    setWarnings([]);
    setSource({ type: 'manual', fileName: null, text: null });
    setDraft(draftFromOffer(null));
    setStage('review');
  }

  function startSample() {
    setWarnings([]);
    setSource({ type: 'manual', fileName: null, text: null });
    setDraft(draftFromOffer(sampleOffer()));
    setStage('review');
    toast.success('Loaded a sample offer — change anything you like');
  }

  async function analyze() {
    const offer: OfferInput = draftToOffer(draft);
    if (offer.lines.length === 0) {
      toast.error('Add at least one line with a description and a price.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer,
          sourceType: source.type,
          fileName: source.fileName,
          rawText: source.text,
          confidence: Math.min(...draft.lines.map((line) => line.confidence ?? 1), 1),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The analysis could not be completed.');

      setResult({ analysis: data.analysis, offerId: data.offerId, usedHistory: Boolean(data.usedHistory) });
      setStage('result');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The analysis could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStage('input');
    setResult(null);
    setWarnings([]);
    setDraft(draftFromOffer(null));
  }

  if (!canAnalyze && stage !== 'result') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-16 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-review/10 text-review">
            <CircleAlert className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-lg font-semibold">You are out of analyses this month</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The Free plan includes three analyses a month. Pro removes the limit and unlocks price
            history and the counter-offer email generator.
          </p>
          <div className="mt-6 flex gap-2">
            <Button asChild>
              <Link href="/app/settings">Upgrade to Pro</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stage === 'result' && result) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Analyse another offer
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/offers/${result.offerId}`}>Open the saved analysis</Link>
          </Button>
        </div>

        <AnalysisResult
          analysis={result.analysis}
          offerId={result.offerId}
          canGenerateEmail={canGenerateEmail}
          usedHistory={result.usedHistory}
        />
      </div>
    );
  }

  if (stage === 'review') {
    const failed = warnings.some((w) => w.code === 'no_lines' || w.code === 'unreadable_file');

    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={reset}>
          <ArrowLeft className="h-4 w-4" />
          Start over
        </Button>

        {warnings.length > 0 ? (
          <Alert variant={failed ? 'warning' : 'info'}>
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>
              {failed ? 'That file could not be read automatically' : 'Some lines need a look'}
            </AlertTitle>
            <AlertDescription className="mt-1 space-y-1">
              {warnings.slice(0, 4).map((warning, index) => (
                <p key={index}>
                  {warning.message}
                  {warning.detail ? <span className="block text-xs opacity-80">{warning.detail}</span> : null}
                </p>
              ))}
              {failed ? (
                <p className="pt-1 font-medium text-foreground">
                  Enter the lines below instead — the analysis is identical either way.
                </p>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {analysesRemaining !== null && analysesRemaining <= 1 ? (
          <Alert variant="info">
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>
              {analysesRemaining === 0
                ? 'This is your last analysis on the Free plan this month.'
                : `${analysesRemaining} analyses left on the Free plan this month.`}
            </AlertDescription>
          </Alert>
        ) : null}

        <OfferEditor
          draft={draft}
          onChange={setDraft}
          onSubmit={analyze}
          submitting={submitting}
          title={failed ? 'Enter the offer' : 'Check the numbers'}
          description={
            failed
              ? 'Add the lines from the quote. Pack size and surcharges matter — they are where the real cost hides.'
              : 'Correct anything that was read wrongly. These values drive the analysis.'
          }
        />

        {source.text ? (
          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-5 py-4 text-sm font-medium">
              What DealGuard read from the file
            </summary>
            <pre className="max-h-80 overflow-auto border-t border-border px-5 py-4 font-mono text-xs leading-relaxed text-muted-foreground">
              {source.text.slice(0, 8000)}
            </pre>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UploadPanel
        onFile={parseFile}
        onText={parseText}
        onManual={startManual}
        onSample={startSample}
        busy={busy}
      />
      {busy ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Pulling out line items, discounts and terms…
        </p>
      ) : null}
    </div>
  );
}
