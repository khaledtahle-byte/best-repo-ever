/**
 * Hand-maintained database types. Keep in step with supabase/schema.sql — or
 * regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
 */

export type PlanIdDb = 'free' | 'pro' | 'business';
export type PlanStatusDb = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
export type OfferStatusDb = 'analyzed' | 'needs_review' | 'failed';
export type VerdictDb = 'good' | 'review' | 'bad';
export type SourceTypeDb = 'pdf' | 'csv' | 'xlsx' | 'text' | 'manual' | 'api';
export type OrgRoleDb = 'owner' | 'admin' | 'member';

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  company_name: string | null;
  org_id: string | null;
  plan: PlanIdDb;
  plan_status: PlanStatusDb;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cost_of_capital_pct: number;
  target_margin_pct: number;
  default_currency: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OrganizationRow = {
  id: string;
  name: string;
  owner_id: string;
  plan: PlanIdDb;
  plan_status: PlanStatusDb;
  seats: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export type OrganizationMemberRow = {
  org_id: string;
  user_id: string;
  role: OrgRoleDb;
  created_at: string;
}

export type SupplierRow = {
  id: string;
  owner_id: string;
  org_id: string | null;
  name: string;
  slug: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type OfferRow = {
  id: string;
  owner_id: string;
  org_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  reference: string | null;
  source_type: SourceTypeDb;
  file_name: string | null;
  raw_text: string | null;
  currency: string;
  status: OfferStatusDb;
  verdict: VerdictDb | null;
  score: number | null;
  confidence: number;
  gross_total: number;
  discount_total: number;
  invoice_subtotal: number;
  freight_total: number;
  fees_total: number;
  invoice_total: number;
  early_payment_saving: number;
  financing_benefit: number;
  rebate_total: number;
  net_total: number;
  margin_total: number | null;
  savings_identified: number;
  payment_net_days: number;
  payment_discount_pct: number;
  payment_discount_days: number;
  freight_flat: number;
  freight_per_unit: number;
  freight_free_above: number | null;
  fees: unknown;
  rebate: unknown;
  headline: string | null;
  summary: string | null;
  analysis: unknown;
  warnings: unknown;
  quoted_at: string;
  created_at: string;
  updated_at: string;
}

export type OfferItemRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  org_id: string | null;
  line_index: number;
  description: string;
  sku: string | null;
  product_key: string;
  uom: string;
  quantity: number;
  pack_size: number;
  units_total: number;
  quoted_unit_price: number;
  list_unit_cost: number;
  invoice_unit_cost: number;
  true_net_unit_cost: number;
  gross_total: number;
  invoice_subtotal: number;
  freight_allocated: number;
  fees_allocated: number;
  invoice_total: number;
  rebate_amount: number;
  net_line_cost: number;
  headline_discount_pct: number;
  effective_discount_pct: number;
  sell_unit_price: number | null;
  true_margin_pct: number | null;
  margin_total: number | null;
  benchmark_unit_cost: number | null;
  benchmark_delta_pct: number | null;
  benchmark_source: string | null;
  confidence: number;
  score: number | null;
  detail: unknown;
  created_at: string;
}

export type OfferFlagRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  org_id: string | null;
  line_index: number | null;
  code: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  detail: string;
  impact_amount: number | null;
  created_at: string;
}

export type CounterOfferRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  org_id: string | null;
  tone: 'collaborative' | 'firm';
  subject: string;
  body: string;
  value: number;
  created_at: string;
}

export type UsageEventRow = {
  id: string;
  owner_id: string;
  org_id: string | null;
  kind: string;
  offer_id: string | null;
  created_at: string;
}

export type ApiKeyRow = {
  id: string;
  owner_id: string;
  org_id: string | null;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export type PriceHistoryRow = {
  id: string;
  offer_id: string;
  owner_id: string;
  org_id: string | null;
  supplier_id: string | null;
  supplier_name: string;
  product_key: string;
  description: string;
  sku: string | null;
  uom: string;
  pack_size: number;
  list_unit_cost: number;
  true_net_unit_cost: number;
  true_margin_pct: number | null;
  currency: string;
  net_days: number;
  occurred_at: string;
}

type Insertable<Row, Optional extends keyof Row> = Omit<Row, Optional> & Partial<Pick<Row, Optional>>;

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, Insertable<ProfileRow, Exclude<keyof ProfileRow, 'id'>>>;
      organizations: Table<
        OrganizationRow,
        Insertable<OrganizationRow, Exclude<keyof OrganizationRow, 'name' | 'owner_id'>>
      >;
      organization_members: Table<
        OrganizationMemberRow,
        Insertable<OrganizationMemberRow, 'role' | 'created_at'>
      >;
      suppliers: Table<
        SupplierRow,
        Insertable<SupplierRow, Exclude<keyof SupplierRow, 'owner_id' | 'name' | 'slug'>>
      >;
      offers: Table<OfferRow, Insertable<OfferRow, Exclude<keyof OfferRow, 'owner_id' | 'supplier_name'>>>;
      offer_items: Table<
        OfferItemRow,
        Insertable<OfferItemRow, Exclude<keyof OfferItemRow, 'offer_id' | 'owner_id' | 'description' | 'product_key'>>
      >;
      offer_flags: Table<
        OfferFlagRow,
        Insertable<OfferFlagRow, Exclude<keyof OfferFlagRow, 'offer_id' | 'owner_id' | 'code' | 'severity' | 'title'>>
      >;
      counter_offers: Table<
        CounterOfferRow,
        Insertable<CounterOfferRow, Exclude<keyof CounterOfferRow, 'offer_id' | 'owner_id' | 'subject' | 'body'>>
      >;
      usage_events: Table<UsageEventRow, Insertable<UsageEventRow, Exclude<keyof UsageEventRow, 'owner_id'>>>;
      api_keys: Table<
        ApiKeyRow,
        Insertable<ApiKeyRow, Exclude<keyof ApiKeyRow, 'owner_id' | 'key_hash' | 'key_prefix'>>
      >;
    };
    Views: {
      price_history: { Row: PriceHistoryRow; Relationships: [] };
    };
    Functions: {
      analyses_this_month: { Args: { uid: string }; Returns: number };
      effective_plan: { Args: { uid: string }; Returns: PlanIdDb };
      is_org_member: { Args: { target_org: string }; Returns: boolean };
      is_org_admin: { Args: { target_org: string }; Returns: boolean };
    };
    Enums: {
      plan_id: PlanIdDb;
      plan_status: PlanStatusDb;
      offer_status: OfferStatusDb;
      verdict: VerdictDb;
      source_type: SourceTypeDb;
      org_role: OrgRoleDb;
    };
    CompositeTypes: Record<string, never>;
  };
}
