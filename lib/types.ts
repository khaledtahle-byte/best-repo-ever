/**
 * Domain model shared by the parsers, the analysis engine, the API routes and
 * the UI. Everything here is plain data so the engine stays pure and testable.
 */

export type SourceType = 'pdf' | 'csv' | 'xlsx' | 'text' | 'manual' | 'api';

export type OfferStatus = 'analyzed' | 'needs_review' | 'failed';

export type Verdict = 'good' | 'review' | 'bad';

export type PlanId = 'free' | 'pro' | 'business';

export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';

/* -------------------------------------------------------------------------- */
/*  Commercial terms                                                          */
/* -------------------------------------------------------------------------- */

/** A volume break: at `minQty` purchase units the supplier gives `discountPct`. */
export interface QuantityTier {
  minQty: number;
  discountPct: number;
  /** Some quotes express the tier as an absolute price instead of a percentage. */
  unitPrice?: number | null;
}

/** Back-end (retrospective) rebate — cash that arrives well after the invoice. */
export interface RebateTerm {
  pct: number;
  /** Qualifies at this many purchase units... */
  thresholdQty?: number | null;
  /** ...or at this much order value. */
  thresholdValue?: number | null;
  /** Days between invoice and rebate settlement (quarterly ≈ 90). */
  lagDays: number;
  scope: 'line' | 'order';
  label?: string;
}

/** "2/10 net 30" — take 2% off if paid within 10 days, otherwise pay at day 30. */
export interface PaymentTerms {
  netDays: number;
  discountPct: number;
  discountDays: number;
  raw?: string | null;
}

export interface FreightTerms {
  /** Flat delivery charge for the whole order. */
  flatPerOrder: number;
  /** Charge applied per purchase unit (per case / per pallet). */
  perUnit: number;
  /** Freight is waived above this order value. `null` means never waived. */
  freeAboveOrderValue: number | null;
  /** How the order-level charge is spread across lines. */
  allocation: 'value' | 'quantity';
}

export type FeeBasis = 'order' | 'unit' | 'percent_of_goods';

/** Surcharges that never appear in the headline price: fuel, pallet, drop fees. */
export interface Fee {
  label: string;
  amount: number;
  basis: FeeBasis;
}

/* -------------------------------------------------------------------------- */
/*  Offer input                                                               */
/* -------------------------------------------------------------------------- */

export interface OfferLineInput {
  /** Original source line, kept so the UI can show what was parsed. */
  raw?: string | null;
  description: string;
  sku?: string | null;
  /** Number of purchase units (cases, drums, each) being quoted. */
  quantity: number;
  /** Units inside one purchase unit — a case of 12 has packSize 12. */
  packSize: number;
  /** Unit of measure of the *inner* unit: kg, L, each… */
  uom: string;
  /** Quoted price for one purchase unit, before any discount. */
  quotedUnitPrice: number;
  /** Off-invoice discount stated on the line, in percent. */
  discountPct: number;
  tiers: QuantityTier[];
  rebate?: RebateTerm | null;
  /** Line-specific surcharges. */
  fees?: Fee[];
  /** What the buyer sells the inner unit for, if known — enables margin maths. */
  sellUnitPrice?: number | null;
  /** 0–1 parser confidence. Anything under 0.6 is surfaced for manual review. */
  confidence?: number;
}

export interface OfferInput {
  supplierName: string;
  reference?: string | null;
  currency: string;
  /** ISO date of the quote. Defaults to now. */
  quotedAt?: string | null;
  lines: OfferLineInput[];
  paymentTerms: PaymentTerms;
  freight: FreightTerms;
  fees: Fee[];
  /** Order-level rebate, applied across all lines. */
  rebate?: RebateTerm | null;
  notes?: string | null;
}

export interface AnalysisOptions {
  /** Annual cost of capital used to price payment terms. Default 12%. */
  costOfCapitalPct: number;
  /** Treat a >= this % gap versus benchmark as materially worse. Default 1%. */
  materialityPct: number;
  /** Freight + fees above this share of goods value is a hidden-cost flag. */
  hiddenCostThresholdPct: number;
  /** Target gross margin used to flag thin lines. Default 25%. */
  targetMarginPct: number;
}

export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  costOfCapitalPct: 12,
  materialityPct: 1,
  hiddenCostThresholdPct: 3,
  targetMarginPct: 25,
};

/* -------------------------------------------------------------------------- */
/*  Benchmarks                                                                */
/* -------------------------------------------------------------------------- */

/** One historical observation of what a product actually cost. */
export interface HistoryPoint {
  offerId: string;
  productKey: string;
  description: string;
  sku?: string | null;
  supplierId: string | null;
  supplierName: string;
  trueNetUnitCost: number;
  /** List price per inner unit (quoted price ÷ pack size) at the time. */
  listUnitCost: number;
  packSize: number;
  occurredAt: string;
  netDays: number;
}

export type BenchmarkSource = 'supplier_history' | 'cross_supplier' | 'own_median' | 'none';

export interface Benchmark {
  source: BenchmarkSource;
  unitCost: number;
  deltaPct: number;
  supplierName?: string;
  occurredAt?: string;
  sampleSize: number;
}

/* -------------------------------------------------------------------------- */
/*  Flags                                                                     */
/* -------------------------------------------------------------------------- */

export type FlagCode =
  | 'worse_than_last'
  | 'better_than_last'
  | 'above_market'
  | 'below_market'
  | 'hidden_cost'
  | 'discount_theater'
  | 'unqualified_rebate'
  | 'rebate_near_threshold'
  | 'freight_threshold_near'
  | 'terms_worse'
  | 'take_early_payment'
  | 'skip_early_payment'
  | 'pack_size_change'
  | 'list_price_increase'
  | 'thin_margin'
  | 'negative_margin'
  | 'low_confidence';

export type FlagSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface Flag {
  code: FlagCode;
  severity: FlagSeverity;
  title: string;
  detail: string;
  /** Money at stake on this order, if quantifiable. */
  impactAmount?: number;
  lineIndex?: number;
}

/* -------------------------------------------------------------------------- */
/*  Analysis output                                                           */
/* -------------------------------------------------------------------------- */

export interface LineAnalysis {
  index: number;
  description: string;
  sku: string | null;
  productKey: string;
  quantity: number;
  packSize: number;
  uom: string;
  /** Total inner units on the line (quantity × packSize). */
  unitsTotal: number;

  quotedUnitPrice: number;
  /** Quoted price divided by pack size — the naive "unit price". */
  listUnitCost: number;

  grossTotal: number;
  tierDiscountPct: number;
  tierDiscountAmount: number;
  lineDiscountPct: number;
  lineDiscountAmount: number;
  invoiceSubtotal: number;

  freightAllocated: number;
  feesAllocated: number;
  invoiceTotal: number;

  earlyPaymentSaving: number;
  financingBenefit: number;
  rebateAmount: number;
  rebateQualified: boolean;
  rebateShortfallUnits: number;

  netLineCost: number;
  /** The number the whole product exists to compute. */
  trueNetUnitCost: number;
  /** What the invoice alone implies, ignoring rebate/terms/freight. */
  invoiceUnitCost: number;

  headlineDiscountPct: number;
  effectiveDiscountPct: number;
  discountGapPct: number;

  sellUnitPrice: number | null;
  grossMarginPct: number | null;
  trueMarginPct: number | null;
  marginPerUnit: number | null;
  marginTotal: number | null;

  benchmark: Benchmark | null;
  flags: Flag[];
  confidence: number;
  score: number;
}

export interface PaymentRecommendation {
  action: 'take_discount' | 'pay_at_terms';
  /** Annualised return on paying early — compare against cost of capital. */
  impliedApr: number | null;
  savingIfTaken: number;
  detail: string;
}

export interface OfferTotals {
  grossTotal: number;
  discountTotal: number;
  invoiceSubtotal: number;
  freightTotal: number;
  feesTotal: number;
  invoiceTotal: number;
  earlyPaymentSaving: number;
  financingBenefit: number;
  rebateTotal: number;
  netTotal: number;
  /** Cash difference between the headline price and the true net cost. */
  headlineVsNet: number;
  marginTotal: number | null;
}

export interface CounterAsk {
  code: string;
  ask: string;
  rationale: string;
  value: number;
}

export interface OfferAnalysis {
  supplierName: string;
  reference: string | null;
  currency: string;
  quotedAt: string;
  lines: LineAnalysis[];
  totals: OfferTotals;
  paymentTerms: PaymentTerms;
  paymentRecommendation: PaymentRecommendation;
  freight: FreightTerms;
  fees: Fee[];
  flags: Flag[];
  verdict: Verdict;
  score: number;
  /** Money the analysis says is recoverable by negotiating. */
  savingsIdentified: number;
  headline: string;
  summary: string;
  asks: CounterAsk[];
  options: AnalysisOptions;
}

/* -------------------------------------------------------------------------- */
/*  Parsing                                                                   */
/* -------------------------------------------------------------------------- */

export interface ParseWarning {
  code: 'no_lines' | 'missing_columns' | 'ambiguous_row' | 'unreadable_file' | 'partial';
  message: string;
  detail?: string;
}

export interface ParseResult {
  ok: boolean;
  sourceType: SourceType;
  /** Extracted plain text, kept for the "what we read" panel and re-parsing. */
  text: string;
  offer: OfferInput | null;
  warnings: ParseWarning[];
  /** Mean line confidence, 0–1. */
  confidence: number;
}
