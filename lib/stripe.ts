import 'server-only';

import Stripe from 'stripe';
import { requiredEnv } from '@/lib/supabase/env';

let cached: Stripe | null = null;

/**
 * Stripe client. The API version is left to the account default so the pinned
 * version cannot drift out of step with the installed SDK types; set
 * STRIPE_API_VERSION to pin it explicitly.
 */
export function getStripe(): Stripe {
  if (!cached) {
    const options: Stripe.StripeConfig = { typescript: true, appInfo: { name: 'DealGuard' } };
    const pinned = process.env.STRIPE_API_VERSION;
    if (pinned) options.apiVersion = pinned as Stripe.StripeConfig['apiVersion'];
    cached = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), options);
  }
  return cached;
}

export function stripeWebhookSecret(): string {
  return requiredEnv('STRIPE_WEBHOOK_SECRET');
}

/** Maps a Stripe subscription status onto the plan_status enum in Postgres. */
export function toPlanStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

export function firstPriceId(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

/** Period end lives on the subscription item in current API versions. */
export function currentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const seconds =
    item?.current_period_end ??
    (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}
