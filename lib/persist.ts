import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, OfferRow, SupplierRow } from '@/lib/supabase/types';
import type { OfferAnalysis, OfferInput, ParseWarning, SourceType } from '@/lib/types';
import { slugify } from '@/lib/utils';

type Client = SupabaseClient<Database>;

/** One supplier row per buyer, matched on a normalised name. */
export async function upsertSupplier(
  supabase: Client,
  ownerId: string,
  orgId: string | null,
  name: string,
): Promise<SupplierRow | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const slug = slugify(trimmed) || trimmed.toLowerCase();

  const { data: existing } = await supabase
    .from('suppliers')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('slug', slug)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('suppliers')
    .insert({ owner_id: ownerId, org_id: orgId, name: trimmed, slug })
    .select('*')
    .single();
  if (error) {
    // A concurrent analysis may have created it first.
    const { data: raced } = await supabase
      .from('suppliers')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('slug', slug)
      .maybeSingle();
    return raced ?? null;
  }
  return data;
}

export interface SaveAnalysisArgs {
  supabase: Client;
  ownerId: string;
  orgId: string | null;
  analysis: OfferAnalysis;
  input: OfferInput;
  sourceType: SourceType;
  fileName?: string | null;
  rawText?: string | null;
  warnings?: ParseWarning[];
  confidence?: number;
}

/**
 * Writes an analysis and everything derived from it. Line items and flags are
 * stored as rows (not only inside the JSON blob) so history, charts and the
 * benchmark queries can be indexed.
 */
export async function saveAnalysis(args: SaveAnalysisArgs): Promise<OfferRow> {
  const { supabase, ownerId, orgId, analysis, input, sourceType } = args;

  const supplier = await upsertSupplier(supabase, ownerId, orgId, analysis.supplierName);

  const { data: offer, error } = await supabase
    .from('offers')
    .insert({
      owner_id: ownerId,
      org_id: orgId,
      supplier_id: supplier?.id ?? null,
      supplier_name: analysis.supplierName,
      reference: analysis.reference,
      source_type: sourceType,
      file_name: args.fileName ?? null,
      raw_text: args.rawText ? args.rawText.slice(0, 100_000) : null,
      currency: analysis.currency,
      status: 'analyzed',
      verdict: analysis.verdict,
      score: analysis.score,
      confidence: args.confidence ?? 1,

      gross_total: analysis.totals.grossTotal,
      discount_total: analysis.totals.discountTotal,
      invoice_subtotal: analysis.totals.invoiceSubtotal,
      freight_total: analysis.totals.freightTotal,
      fees_total: analysis.totals.feesTotal,
      invoice_total: analysis.totals.invoiceTotal,
      early_payment_saving: analysis.totals.earlyPaymentSaving,
      financing_benefit: analysis.totals.financingBenefit,
      rebate_total: analysis.totals.rebateTotal,
      net_total: analysis.totals.netTotal,
      margin_total: analysis.totals.marginTotal,
      savings_identified: analysis.savingsIdentified,

      payment_net_days: analysis.paymentTerms.netDays,
      payment_discount_pct: analysis.paymentTerms.discountPct,
      payment_discount_days: analysis.paymentTerms.discountDays,
      freight_flat: analysis.freight.flatPerOrder,
      freight_per_unit: analysis.freight.perUnit,
      freight_free_above: analysis.freight.freeAboveOrderValue,
      fees: analysis.fees,
      rebate: input.rebate ?? null,

      headline: analysis.headline,
      summary: analysis.summary,
      analysis: analysis as unknown as Record<string, unknown>,
      warnings: (args.warnings ?? []) as unknown as Record<string, unknown>[],
      quoted_at: analysis.quotedAt,
    })
    .select('*')
    .single();

  if (error || !offer) throw error ?? new Error('Failed to save the analysis.');

  if (analysis.lines.length > 0) {
    const { error: itemsError } = await supabase.from('offer_items').insert(
      analysis.lines.map((line) => ({
        offer_id: offer.id,
        owner_id: ownerId,
        org_id: orgId,
        line_index: line.index,
        description: line.description,
        sku: line.sku,
        product_key: line.productKey,
        uom: line.uom,
        quantity: line.quantity,
        pack_size: line.packSize,
        units_total: line.unitsTotal,
        quoted_unit_price: line.quotedUnitPrice,
        list_unit_cost: line.listUnitCost,
        invoice_unit_cost: line.invoiceUnitCost,
        true_net_unit_cost: line.trueNetUnitCost,
        gross_total: line.grossTotal,
        invoice_subtotal: line.invoiceSubtotal,
        freight_allocated: line.freightAllocated,
        fees_allocated: line.feesAllocated,
        invoice_total: line.invoiceTotal,
        rebate_amount: line.rebateAmount,
        net_line_cost: line.netLineCost,
        headline_discount_pct: line.headlineDiscountPct,
        effective_discount_pct: line.effectiveDiscountPct,
        sell_unit_price: line.sellUnitPrice,
        true_margin_pct: line.trueMarginPct,
        margin_total: line.marginTotal,
        benchmark_unit_cost: line.benchmark?.unitCost ?? null,
        benchmark_delta_pct: line.benchmark?.deltaPct ?? null,
        benchmark_source: line.benchmark?.source ?? null,
        confidence: line.confidence,
        score: line.score,
        detail: line as unknown as Record<string, unknown>,
      })),
    );
    if (itemsError) throw itemsError;
  }

  if (analysis.flags.length > 0) {
    const { error: flagsError } = await supabase.from('offer_flags').insert(
      analysis.flags.map((flag) => ({
        offer_id: offer.id,
        owner_id: ownerId,
        org_id: orgId,
        line_index: flag.lineIndex ?? null,
        code: flag.code,
        severity: flag.severity,
        title: flag.title,
        detail: flag.detail,
        impact_amount: flag.impactAmount ?? null,
      })),
    );
    if (flagsError) throw flagsError;
  }

  return offer;
}
