import { NextResponse, type NextRequest } from 'next/server';
import { authenticateApiKey } from '@/lib/api-keys';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleRouteError, jsonError } from '@/lib/api';
import { analyzeOffer } from '@/lib/analysis/engine';
import { productKey } from '@/lib/analysis/product-key';
import { getPriceHistory, toHistoryPoints } from '@/lib/queries';
import { saveAnalysis } from '@/lib/persist';
import { parseOfferText } from '@/lib/parsing';
import { offerInputSchema } from '@/lib/validation';
import type { OfferInput } from '@/lib/types';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Business-plan API. Accepts either a structured offer or raw text:
 *
 *   curl -X POST https://<host>/api/v1/analyze \
 *     -H "Authorization: Bearer dg_..." \
 *     -H "Content-Type: application/json" \
 *     -d '{"text": "Mozzarella 2.5kg block  120  18.40  6%"}'
 */
export async function POST(request: NextRequest) {
  try {
    const context = await authenticateApiKey(request.headers.get('authorization'));
    if (!context) {
      return jsonError('Provide a valid API key in the Authorization header.', 401, {
        code: 'unauthenticated',
      });
    }
    if (!PLANS[context.plan].api) {
      return jsonError('API access is part of the Business plan.', 402, { code: 'upgrade_required' });
    }

    const body = (await request.json()) as { offer?: unknown; text?: unknown; save?: unknown };

    let input: OfferInput;
    let sourceType: 'api' | 'text' = 'api';
    let rawText: string | null = null;

    if (typeof body.text === 'string' && body.text.trim()) {
      const parsed = parseOfferText(body.text);
      if (!parsed.ok || !parsed.offer) {
        return NextResponse.json(
          { error: 'No line items could be read from the text.', warnings: parsed.warnings },
          { status: 422 },
        );
      }
      input = parsed.offer;
      sourceType = 'text';
      rawText = parsed.text;
    } else {
      input = offerInputSchema.parse(body.offer) as OfferInput;
    }

    // The key authenticates, so this runs with the service role — every query
    // is therefore scoped explicitly to the key's owner.
    const admin = createAdminClient();
    const keys = Array.from(new Set(input.lines.map((line) => productKey(line.description, line.sku))));
    const history = toHistoryPoints(
      await getPriceHistory(admin, context.ownerId, context.orgId, { productKeys: keys }),
    );

    const analysis = analyzeOffer(input, history, {
      costOfCapitalPct: Number(context.profile.cost_of_capital_pct ?? 12),
      targetMarginPct: Number(context.profile.target_margin_pct ?? 25),
    });

    const shouldSave = body.save !== false;
    let offerId: string | null = null;

    if (shouldSave) {
      const saved = await saveAnalysis({
        supabase: admin,
        ownerId: context.ownerId,
        orgId: context.orgId,
        analysis,
        input,
        sourceType,
        rawText,
      });
      offerId = saved.id;
      await admin.from('usage_events').insert({
        owner_id: context.ownerId,
        org_id: context.orgId,
        kind: 'analysis',
        offer_id: saved.id,
      });
    }

    return NextResponse.json({ offerId, analysis });
  } catch (error) {
    return handleRouteError(error);
  }
}
