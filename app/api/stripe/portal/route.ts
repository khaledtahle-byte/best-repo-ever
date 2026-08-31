import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { handleRouteError, jsonError } from '@/lib/api';
import { getSiteUrl } from '@/lib/utils';

export const runtime = 'nodejs';

/** Sends the customer to Stripe to change plan, update a card or cancel. */
export async function POST() {
  try {
    const session = await getSessionContext();
    if (!session) return jsonError('Sign in first.', 401, { code: 'unauthenticated' });

    const customerId = session.organization?.stripe_customer_id ?? session.profile.stripe_customer_id;
    if (!customerId) {
      return jsonError('There is no billing account to manage yet — start a subscription first.', 400, {
        code: 'no_customer',
      });
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getSiteUrl()}/app/settings`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return handleRouteError(error);
  }
}
