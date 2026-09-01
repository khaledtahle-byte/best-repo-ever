import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OfferRow, PriceHistoryRow, SupplierRow } from '@/lib/supabase/types';
import type { HistoryPoint } from '@/lib/types';

type Client = SupabaseClient<Database>;

export const OFFER_LIST_COLUMNS =
  'id, supplier_name, supplier_id, reference, source_type, file_name, status, verdict, score, currency, net_total, invoice_total, savings_identified, margin_total, quoted_at, created_at, headline';

export type OfferListItem = Pick<
  OfferRow,
  | 'id'
  | 'supplier_name'
  | 'supplier_id'
  | 'reference'
  | 'source_type'
  | 'file_name'
  | 'status'
  | 'verdict'
  | 'score'
  | 'currency'
  | 'net_total'
  | 'invoice_total'
  | 'savings_identified'
  | 'margin_total'
  | 'quoted_at'
  | 'created_at'
  | 'headline'
>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgREST filter for the rows a user may see: their own, plus their
 * organisation's. Ids come from the session, but they are still validated
 * before being interpolated into a filter string.
 */
export function ownershipFilter(userId: string, orgId: string | null): string {
  if (!UUID.test(userId)) throw new Error('Invalid user id');
  const own = `owner_id.eq.${userId}`;
  if (!orgId) return own;
  if (!UUID.test(orgId)) throw new Error('Invalid organisation id');
  return `${own},org_id.eq.${orgId}`;
}

export async function listOffers(
  supabase: Client,
  userId: string,
  orgId: string | null,
  limit = 50,
): Promise<OfferListItem[]> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_LIST_COLUMNS)
    .or(ownershipFilter(userId, orgId))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as OfferListItem[];
}

export interface DashboardStats {
  totalOffers: number;
  analyzedThisMonth: number;
  savingsIdentified: number;
  badDeals: number;
  reviewDeals: number;
  goodDeals: number;
  suppliers: number;
}

export async function getDashboardStats(
  supabase: Client,
  userId: string,
  orgId: string | null,
): Promise<DashboardStats> {
  const { data, error } = await supabase
    .from('offers')
    .select('verdict, savings_identified, created_at, supplier_id')
    .or(ownershipFilter(userId, orgId))
    .limit(1000);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    verdict: string | null;
    savings_identified: number | null;
    created_at: string;
    supplier_id: string | null;
  }>;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return {
    totalOffers: rows.length,
    analyzedThisMonth: rows.filter((r) => new Date(r.created_at) >= monthStart).length,
    savingsIdentified: rows.reduce((acc, r) => acc + Number(r.savings_identified ?? 0), 0),
    badDeals: rows.filter((r) => r.verdict === 'bad').length,
    reviewDeals: rows.filter((r) => r.verdict === 'review').length,
    goodDeals: rows.filter((r) => r.verdict === 'good').length,
    suppliers: new Set(rows.map((r) => r.supplier_id).filter(Boolean)).size,
  };
}

export async function listSuppliers(
  supabase: Client,
  userId: string,
  orgId: string | null,
): Promise<SupplierRow[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .or(ownershipFilter(userId, orgId))
    .order('name');
  if (error) throw error;
  return (data ?? []) as unknown as SupplierRow[];
}

/**
 * Every past observation of what a product really cost, used both for the
 * supplier charts and as the benchmark the engine compares a new offer against.
 */
export async function getPriceHistory(
  supabase: Client,
  userId: string,
  orgId: string | null,
  options: { productKeys?: string[]; supplierId?: string; limit?: number } = {},
): Promise<PriceHistoryRow[]> {
  let query = supabase.from('price_history').select('*').or(ownershipFilter(userId, orgId));

  if (options.productKeys && options.productKeys.length > 0) {
    query = query.in('product_key', options.productKeys.slice(0, 200));
  }
  if (options.supplierId) query = query.eq('supplier_id', options.supplierId);

  const { data, error } = await query
    .order('occurred_at', { ascending: false })
    .limit(options.limit ?? 500);
  if (error) throw error;
  return (data ?? []) as unknown as PriceHistoryRow[];
}

export function toHistoryPoints(rows: PriceHistoryRow[]): HistoryPoint[] {
  return rows.map((row) => ({
    offerId: row.offer_id,
    productKey: row.product_key,
    description: row.description,
    sku: row.sku,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    trueNetUnitCost: Number(row.true_net_unit_cost),
    listUnitCost: Number(row.list_unit_cost),
    packSize: Number(row.pack_size),
    occurredAt: row.occurred_at,
    netDays: Number(row.net_days ?? 30),
  }));
}

export interface SupplierSummary extends SupplierRow {
  offerCount: number;
  lastOfferAt: string | null;
  averageScore: number | null;
  savingsIdentified: number;
  netTotal: number;
  currency: string;
  worstVerdict: 'good' | 'review' | 'bad' | null;
}

export async function getSupplierSummaries(
  supabase: Client,
  userId: string,
  orgId: string | null,
): Promise<SupplierSummary[]> {
  const [suppliers, offers] = await Promise.all([
    listSuppliers(supabase, userId, orgId),
    listOffers(supabase, userId, orgId, 500),
  ]);

  return suppliers
    .map((supplier) => {
      const own = offers.filter((offer) => offer.supplier_id === supplier.id);
      const scores = own.map((o) => o.score).filter((s): s is number => typeof s === 'number');
      const verdicts = own.map((o) => o.verdict);
      return {
        ...supplier,
        offerCount: own.length,
        lastOfferAt: own[0]?.quoted_at ?? null,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        savingsIdentified: own.reduce((acc, o) => acc + Number(o.savings_identified ?? 0), 0),
        netTotal: own.reduce((acc, o) => acc + Number(o.net_total ?? 0), 0),
        currency: own[0]?.currency ?? 'USD',
        worstVerdict: verdicts.includes('bad')
          ? ('bad' as const)
          : verdicts.includes('review')
            ? ('review' as const)
            : verdicts.includes('good')
              ? ('good' as const)
              : null,
      };
    })
    .sort((a, b) => b.offerCount - a.offerCount || a.name.localeCompare(b.name));
}
