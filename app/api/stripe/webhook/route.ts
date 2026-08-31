import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentPeriodEnd, firstPriceId, getStripe, stripeWebhookSecret, toPlanStatus } from '@/lib/stripe';
import { planForPriceId, PLANS } from '@/lib/plans';
import { jsonError } from '@/lib/api';
import type { PlanIdDb, PlanStatusDb } from '@/lib/supabase/types';

export const runtime = 'nodejs';
// The signature is computed over the raw body, so it must not be parsed early.
export const dynamic = 'force-dynamic';

const HANDLED: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) return jsonError('Missing stripe-signature header.', 400);

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = getStripe().webhooks.constructEvent(payload, signature, stripeWebhookSecret());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid payload';
    console.error('[stripe] signature verification failed:', message);
    return jsonError(`Webhook signature verification failed: ${message}`, 400);
  }

  if (!HANDLED.includes(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id ?? null;
        if (session.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
          );
          await applySubscription(subscription, userId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await applySubscription(subscription, subscription.metadata?.supabase_user_id ?? null);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | null };
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customerId) await markPastDue(customerId);
        break;
      }
    }
  } catch (error) {
    console.error('[stripe] handler failed for', event.type, error);
    // A 500 makes Stripe retry, which is what we want for a transient failure.
    return jsonError('Webhook handler failed.', 500);
  }

  return NextResponse.json({ received: true });
}

/**
 * Writes the subscription state onto the profile — and, for Business, onto an
 * organisation so the plan's seats can be shared.
 */
async function applySubscription(subscription: Stripe.Subscription, userIdHint: string | null) {
  const admin = createAdminClient();
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const cancelled = subscription.status === 'canceled' || subscription.status === 'incomplete_expired';
  const plan = cancelled ? 'free' : planForPriceId(firstPriceId(subscription));
  const status = toPlanStatus(subscription.status) as PlanStatusDb;
  const periodEnd = currentPeriodEnd(subscription);

  // Resolve the user: metadata first, then the stored customer id.
  let userId = userIdHint;
  if (!userId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) {
    console.error('[stripe] no profile matches customer', customerId);
    return;
  }

  await admin
    .from('profiles')
    .update({
      plan: plan as PlanIdDb,
      plan_status: status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      current_period_end: periodEnd,
    })
    .eq('id', userId);

  if (plan === 'business' && !cancelled) {
    await ensureBusinessOrganization(userId, customerId, subscription.id, status, periodEnd);
  } else {
    // Downgrading away from Business leaves the organisation in place but stops
    // it granting the plan, so seats no longer inherit Business.
    await admin
      .from('organizations')
      .update({ plan: plan as PlanIdDb, plan_status: status, current_period_end: periodEnd })
      .eq('stripe_subscription_id', subscription.id);
  }
}

async function ensureBusinessOrganization(
  userId: string,
  customerId: string,
  subscriptionId: string,
  status: PlanStatusDb,
  periodEnd: string | null,
) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .maybeSingle();

  if (existing) {
    await admin
      .from('organizations')
      .update({
        plan: 'business',
        plan_status: status,
        seats: PLANS.business.seats,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        current_period_end: periodEnd,
      })
      .eq('id', existing.id);
    await admin.from('profiles').update({ org_id: existing.id }).eq('id', userId);
    return;
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('company_name, full_name, email')
    .eq('id', userId)
    .maybeSingle();

  const { data: created, error } = await admin
    .from('organizations')
    .insert({
      name: profile?.company_name || profile?.full_name || profile?.email || 'My organisation',
      owner_id: userId,
      plan: 'business',
      plan_status: status,
      seats: PLANS.business.seats,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: periodEnd,
    })
    .select('id')
    .single();

  if (error || !created) {
    console.error('[stripe] could not create organisation', error);
    return;
  }

  await admin.from('organization_members').insert({ org_id: created.id, user_id: userId, role: 'owner' });
  await admin.from('profiles').update({ org_id: created.id }).eq('id', userId);
}

async function markPastDue(customerId: string) {
  const admin = createAdminClient();
  await admin.from('profiles').update({ plan_status: 'past_due' }).eq('stripe_customer_id', customerId);
  await admin.from('organizations').update({ plan_status: 'past_due' }).eq('stripe_customer_id', customerId);
}
