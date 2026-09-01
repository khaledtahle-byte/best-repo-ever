import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleRouteError, jsonError } from '@/lib/api';
import { analyzeOffer } from '@/lib/analysis/engine';
import { productKey } from '@/lib/analysis/product-key';
import { getPriceHistory, toHistoryPoints } from '@/lib/queries';
import { saveAnalysis } from '@/lib/persist';
import { analyzeRequestSchema } from '@/lib/validation';
import type { OfferInput } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in to analyse an offer.', 401, { code: 'unauthenticated' });

    if (!session.entitlements.canAnalyze) {
      return jsonError(
        `You have used all ${session.entitlements.analysesLimit} analyses on the Free plan this month. Upgrade to Pro for unlimited analyses.`,
        402,
        { code: 'quota_exceeded' },
      );
    }

    const body = await request.json();
    const { offer, sourceType, fileName, rawText, confidence } = analyzeRequestSchema.parse(body);
    const input = offer as OfferInput;

    const supabase = createClient();

    // Benchmarks come only from the products in this offer, so a large history
    // never turns into a large query.
    const keys = Array.from(new Set(input.lines.map((line) => productKey(line.description, line.sku))));
    const history = session.entitlements.canUseHistory
      ? toHistoryPoints(
          await getPriceHistory(supabase, session.user.id, session.orgId, { productKeys: keys }),
        )
      : [];

    const analysis = analyzeOffer(input, history, {
      costOfCapitalPct: Number(session.profile.cost_of_capital_pct ?? 12),
      targetMarginPct: Number(session.profile.target_margin_pct ?? 25),
    });

    const saved = await saveAnalysis({
      supabase,
      ownerId: session.user.id,
      orgId: session.orgId,
      analysis,
      input,
      sourceType,
      fileName: fileName ?? null,
      rawText: rawText ?? null,
      confidence: confidence ?? 1,
    });

    // Metering is written with the service role so it cannot be skipped by a
    // client that stops sending the request half way through.
    const admin = createAdminClient();
    await admin.from('usage_events').insert({
      owner_id: session.user.id,
      org_id: session.orgId,
      kind: 'analysis',
      offer_id: saved.id,
    });

    return NextResponse.json({
      offerId: saved.id,
      analysis,
      usedHistory: history.length > 0,
      historyPoints: history.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
