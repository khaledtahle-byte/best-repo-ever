import type { PlanId } from '@/lib/types';

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number;
  tagline: string;
  /** null = unlimited */
  monthlyAnalyses: number | null;
  seats: number;
  history: boolean;
  emailGenerator: boolean;
  api: boolean;
  highlight?: boolean;
  cta: string;
  features: PlanFeature[];
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    tagline: 'Check a deal before you sign it.',
    monthlyAnalyses: 3,
    seats: 1,
    history: false,
    emailGenerator: false,
    api: false,
    cta: 'Start free',
    features: [
      { label: '3 offer analyses per month', included: true },
      { label: 'True net unit cost + margin breakdown', included: true },
      { label: 'Hidden-cost and rebate detection', included: true },
      { label: 'PDF, CSV, XLSX and paste-in parsing', included: true },
      { label: 'Price history and supplier trends', included: false },
      { label: 'Counter-offer email generator', included: false },
      { label: 'API access', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 49,
    tagline: 'For the person who signs the orders.',
    monthlyAnalyses: null,
    seats: 1,
    history: true,
    emailGenerator: true,
    api: false,
    highlight: true,
    cta: 'Upgrade to Pro',
    features: [
      { label: 'Unlimited offer analyses', included: true },
      { label: 'Full price history per supplier and product', included: true },
      { label: '"Worse than your last offer" benchmarking', included: true },
      { label: 'Counter-offer email generator', included: true },
      { label: 'Cross-supplier price comparison', included: true },
      { label: 'CSV export of every analysis', included: true },
      { label: 'API access', included: false },
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    priceMonthly: 149,
    tagline: 'For multi-site groups and buying teams.',
    monthlyAnalyses: null,
    seats: 5,
    history: true,
    emailGenerator: true,
    api: true,
    cta: 'Upgrade to Business',
    features: [
      { label: 'Everything in Pro', included: true },
      { label: '5 seats with a shared supplier history', included: true },
      { label: 'API access for automated offer intake', included: true },
      { label: 'Shared counter-offer templates', included: true },
      { label: 'Priority support', included: true },
      { label: 'Onboarding session for your buying team', included: true },
      { label: 'Invoice billing on request', included: true },
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'business'];

export function getPlan(id: string | null | undefined): PlanDefinition {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS.free;
}

/** Stripe price ids come from env so the same code runs in test and live mode. */
export function priceIdForPlan(plan: PlanId): string | null {
  switch (plan) {
    case 'pro':
      return process.env.STRIPE_PRICE_PRO ?? null;
    case 'business':
      return process.env.STRIPE_PRICE_BUSINESS ?? null;
    default:
      return null;
  }
}

export function planForPriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return 'free';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
  return 'free';
}

export interface Entitlements {
  plan: PlanId;
  planName: string;
  analysesUsed: number;
  analysesLimit: number | null;
  analysesRemaining: number | null;
  canAnalyze: boolean;
  canUseHistory: boolean;
  canGenerateEmail: boolean;
  canUseApi: boolean;
  seats: number;
}

export function buildEntitlements(plan: PlanId, analysesUsed: number): Entitlements {
  const def = PLANS[plan];
  const limit = def.monthlyAnalyses;
  const remaining = limit === null ? null : Math.max(0, limit - analysesUsed);
  return {
    plan,
    planName: def.name,
    analysesUsed,
    analysesLimit: limit,
    analysesRemaining: remaining,
    canAnalyze: limit === null || analysesUsed < limit,
    canUseHistory: def.history,
    canGenerateEmail: def.emailGenerator,
    canUseApi: def.api,
    seats: def.seats,
  };
}
