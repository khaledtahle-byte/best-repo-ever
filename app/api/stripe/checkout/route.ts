import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';
import { handleRouteError, jsonError } from '@/lib/api';
import { checkoutRequestSchema } from '@/lib/validation';
import { priceIdForPlan } from '@/lib/plans';
import { getSiteUrl } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    const { plan } = checkoutRequestSchema.parse(await request.json());
    const priceId = priceIdForPlan(plan);
    if (!priceId) {
      return jsonError(
        `No Stripe price is configured for the ${plan} plan. Set STRIPE_PRICE_${plan.toUpperCase()} — see README.md.`,
        500,
        { code: 'not_configured' },
      );
    }

    const stripe = getStripe();
    const supabase = createClient();
    const siteUrl = getSiteUrl();

    // Reuse the customer so a second subscription does not orphan the first.
    let customerId = session.profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        name: session.profile.company_name ?? session.profile.full_name ?? undefined,
        metadata: { supabase_user_id: session.user.id },
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', session.user.id);
    }

    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: session.user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${siteUrl}/app/settings?checkout=success`,
      cancel_url: `${siteUrl}/app/settings?checkout=cancelled`,
      subscription_data: {
        metadata: { supabase_user_id: session.user.id, plan },
      },
      metadata: { supabase_user_id: session.user.id, plan },
    });

    if (!checkout.url) return jsonError('Stripe did not return a checkout URL.', 502);
    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
