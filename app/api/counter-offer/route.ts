import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { handleRouteError, jsonError } from '@/lib/api';
import { generateCounterOffer } from '@/lib/analysis/counter-offer';
import { counterOfferRequestSchema } from '@/lib/validation';
import type { OfferAnalysis } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    if (!session.entitlements.canGenerateEmail) {
      return jsonError(
        'The counter-offer email generator is part of Pro. Upgrade to draft the email automatically.',
        402,
        { code: 'upgrade_required' },
      );
    }

    const body = await request.json();
    const { offerId, tone, supplierContact, deadlineDays, save } = counterOfferRequestSchema.parse(body);

    const supabase = createClient();
    const { data: offer, error } = await supabase
      .from('offers')
      .select('id, analysis, owner_id, org_id')
      .eq('id', offerId)
      .maybeSingle();

    if (error) throw error;
    if (!offer) return jsonError('That analysis could not be found.', 404);

    const analysis = offer.analysis as unknown as OfferAnalysis;
    if (!analysis?.lines) return jsonError('That analysis has no line items to negotiate.', 422);

    const counter = generateCounterOffer({
      analysis,
      buyerName: session.profile.full_name ?? 'Purchasing',
      buyerCompany: session.profile.company_name ?? '',
      supplierContact: supplierContact ?? null,
      tone,
      deadlineDays,
    });

    if (save) {
      await supabase.from('counter_offers').insert({
        offer_id: offer.id,
        owner_id: session.user.id,
        org_id: session.orgId,
        tone,
        subject: counter.subject,
        body: counter.body,
        value: counter.value,
      });
    }

    return NextResponse.json(counter);
  } catch (error) {
    return handleRouteError(error);
  }
}
