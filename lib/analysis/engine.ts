import {
  DEFAULT_ANALYSIS_OPTIONS,
  type AnalysisOptions,
  type Benchmark,
  type CounterAsk,
  type Fee,
  type Flag,
  type FlagCode,
  type HistoryPoint,
  type LineAnalysis,
  type OfferAnalysis,
  type OfferInput,
  type OfferLineInput,
  type OfferTotals,
  type PaymentRecommendation,
  type Verdict,
} from '@/lib/types';
import { clamp, median, ratio, round, sum } from '@/lib/utils';
import { formatCurrency, formatPercent, formatUnitPrice } from '@/lib/format';
import { descriptionSimilarity, FUZZY_MATCH_THRESHOLD, productKey } from '@/lib/analysis/product-key';

/* -------------------------------------------------------------------------- */
/*  Normalisation                                                             */
/* -------------------------------------------------------------------------- */

interface NormalizedLine extends OfferLineInput {
  index: number;
  key: string;
  unitsTotal: number;
  grossTotal: number;
}

function normalizeLine(line: OfferLineInput, index: number): NormalizedLine {
  const quantity = Math.max(0, Number(line.quantity) || 0);
  const packSize = Math.max(1e-9, Number(line.packSize) || 1);
  const quotedUnitPrice = Math.max(0, Number(line.quotedUnitPrice) || 0);
  return {
    ...line,
    index,
    quantity,
    packSize,
    quotedUnitPrice,
    uom: line.uom || 'unit',
    discountPct: clamp(Number(line.discountPct) || 0, 0, 100),
    tiers: (line.tiers ?? []).filter((t) => Number.isFinite(t.minQty)),
    fees: line.fees ?? [],
    confidence: clamp(line.confidence ?? 1, 0, 1),
    key: productKey(line.description, line.sku),
    unitsTotal: quantity * packSize,
    grossTotal: quantity * quotedUnitPrice,
  };
}

/** The best volume break the ordered quantity actually qualifies for. */
export function resolveTier(line: NormalizedLine): { pct: number; unitPrice: number | null; minQty: number | null } {
  let best = { pct: 0, unitPrice: null as number | null, minQty: null as number | null };
  for (const tier of line.tiers) {
    if (line.quantity < tier.minQty) continue;
    const pct = tier.unitPrice && tier.unitPrice > 0 && line.quotedUnitPrice > 0
      ? (1 - tier.unitPrice / line.quotedUnitPrice) * 100
      : tier.discountPct;
    if (pct > best.pct) best = { pct: clamp(pct, 0, 100), unitPrice: tier.unitPrice ?? null, minQty: tier.minQty };
  }
  return best;
}

/** The next unreached volume break, used to tell the buyer what to ask for. */
function nextTier(line: NormalizedLine, currentPct: number): { minQty: number; pct: number } | null {
  const candidates = line.tiers
    .filter((t) => t.minQty > line.quantity)
    .map((t) => ({
      minQty: t.minQty,
      pct: t.unitPrice && t.unitPrice > 0 && line.quotedUnitPrice > 0
        ? (1 - t.unitPrice / line.quotedUnitPrice) * 100
        : t.discountPct,
    }))
    .filter((t) => t.pct > currentPct)
    .sort((a, b) => a.minQty - b.minQty);
  return candidates[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Fees and freight                                                          */
/* -------------------------------------------------------------------------- */

function orderFeeAmount(fee: Fee, goodsSubtotal: number, totalQuantity: number): number {
  switch (fee.basis) {
    case 'order':
      return Math.max(0, fee.amount);
    case 'unit':
      return Math.max(0, fee.amount) * totalQuantity;
    case 'percent_of_goods':
      return (goodsSubtotal * Math.max(0, fee.amount)) / 100;
    default:
      return 0;
  }
}

/* -------------------------------------------------------------------------- */
/*  Benchmarking                                                              */
/* -------------------------------------------------------------------------- */

function pickBenchmark(
  line: NormalizedLine,
  trueNetUnitCost: number,
  supplierName: string,
  history: HistoryPoint[],
): Benchmark | null {
  const matches = history.filter(
    (point) =>
      point.productKey === line.key ||
      descriptionSimilarity(point.description, line.description) >= FUZZY_MATCH_THRESHOLD,
  );
  if (matches.length === 0) return null;

  const sorted = matches.slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const sameSupplier = sorted.filter(
    (p) => p.supplierName.trim().toLowerCase() === supplierName.trim().toLowerCase(),
  );

  // The most useful comparison is the last time this same supplier quoted it.
  if (sameSupplier.length > 0) {
    const last = sameSupplier[0];
    return {
      source: 'supplier_history',
      unitCost: last.trueNetUnitCost,
      deltaPct: pctDelta(trueNetUnitCost, last.trueNetUnitCost),
      supplierName: last.supplierName,
      occurredAt: last.occurredAt,
      sampleSize: sameSupplier.length,
    };
  }

  // Otherwise: what other suppliers charge the buyer for the same product.
  const others = sorted.filter(
    (p) => p.supplierName.trim().toLowerCase() !== supplierName.trim().toLowerCase(),
  );
  if (others.length > 0) {
    const med = median(others.map((p) => p.trueNetUnitCost));
    if (med !== null) {
      const cheapest = others.slice().sort((a, b) => a.trueNetUnitCost - b.trueNetUnitCost)[0];
      return {
        source: 'cross_supplier',
        unitCost: med,
        deltaPct: pctDelta(trueNetUnitCost, med),
        supplierName: cheapest.supplierName,
        occurredAt: cheapest.occurredAt,
        sampleSize: others.length,
      };
    }
  }

  const med = median(sorted.map((p) => p.trueNetUnitCost));
  if (med === null) return null;
  return {
    source: 'own_median',
    unitCost: med,
    deltaPct: pctDelta(trueNetUnitCost, med),
    occurredAt: sorted[0].occurredAt,
    sampleSize: sorted.length,
  };
}

/** Positive means "this offer is more expensive than the benchmark". */
/**
 * Quantity thresholds count purchase units (cases, drums, blocks), never the
 * inner unit of measure — a line quoted per kilo is still ordered by the case.
 */
function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

function pctDelta(current: number, benchmark: number): number {
  if (!benchmark) return 0;
  return ((current - benchmark) / benchmark) * 100;
}

function lastListPriceFor(line: NormalizedLine, supplierName: string, history: HistoryPoint[]) {
  return history
    .filter(
      (p) =>
        p.supplierName.trim().toLowerCase() === supplierName.trim().toLowerCase() &&
        (p.productKey === line.key ||
          descriptionSimilarity(p.description, line.description) >= FUZZY_MATCH_THRESHOLD),
    )
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
}

/* -------------------------------------------------------------------------- */
/*  Payment terms                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Annualised return on taking an early-payment discount. 2/10 net 30 means you
 * earn 2% for paying 20 days sooner — about 37% a year, which is why passing on
 * it is usually a mistake.
 */
export function impliedApr(discountPct: number, discountDays: number, netDays: number): number | null {
  if (discountPct <= 0 || netDays <= discountDays) return null;
  const periods = 365 / (netDays - discountDays);
  return (discountPct / (100 - discountPct)) * periods * 100;
}

/* -------------------------------------------------------------------------- */
/*  Engine                                                                    */
/* -------------------------------------------------------------------------- */

export function analyzeOffer(
  input: OfferInput,
  history: HistoryPoint[] = [],
  optionsOverride: Partial<AnalysisOptions> = {},
): OfferAnalysis {
  const options: AnalysisOptions = { ...DEFAULT_ANALYSIS_OPTIONS, ...optionsOverride };
  const dailyRate = options.costOfCapitalPct / 100 / 365;
  const currency = input.currency || 'USD';
  const lines = input.lines.map(normalizeLine);

  /* ---- invoice level -------------------------------------------------- */

  const perLine = lines.map((line) => {
    const tier = resolveTier(line);
    const tierDiscountAmount = (line.grossTotal * tier.pct) / 100;
    const afterTier = line.grossTotal - tierDiscountAmount;
    const lineDiscountAmount = (afterTier * line.discountPct) / 100;
    const invoiceSubtotal = afterTier - lineDiscountAmount;
    return { line, tier, tierDiscountAmount, lineDiscountAmount, invoiceSubtotal };
  });

  const goodsSubtotal = sum(perLine.map((p) => p.invoiceSubtotal));
  const totalQuantity = sum(lines.map((l) => l.quantity));

  const freight = input.freight;
  const freightWaived =
    freight.freeAboveOrderValue !== null && goodsSubtotal >= freight.freeAboveOrderValue;
  const freightTotal = freightWaived
    ? Math.max(0, freight.perUnit) * totalQuantity
    : Math.max(0, freight.flatPerOrder) + Math.max(0, freight.perUnit) * totalQuantity;

  const orderFees = (input.fees ?? []).map((fee) => ({
    fee,
    amount: orderFeeAmount(fee, goodsSubtotal, totalQuantity),
  }));
  const orderFeesTotal = sum(orderFees.map((f) => f.amount));

  const terms = input.paymentTerms;
  const apr = impliedApr(terms.discountPct, terms.discountDays, terms.netDays);

  /* ---- per line ------------------------------------------------------- */

  const analyzed: LineAnalysis[] = perLine.map((entry) => {
    const { line, tier, tierDiscountAmount, lineDiscountAmount, invoiceSubtotal } = entry;

    const share =
      freight.allocation === 'quantity'
        ? ratio(line.quantity, totalQuantity, lines.length ? 1 / lines.length : 0)
        : ratio(invoiceSubtotal, goodsSubtotal, lines.length ? 1 / lines.length : 0);
    const valueShare = ratio(invoiceSubtotal, goodsSubtotal, lines.length ? 1 / lines.length : 0);

    const freightAllocated = freightTotal * share;
    const lineOwnFees = sum(
      (line.fees ?? []).map((fee) => orderFeeAmount(fee, invoiceSubtotal, line.quantity)),
    );
    const feesAllocated = orderFeesTotal * valueShare + lineOwnFees;
    const invoiceTotal = invoiceSubtotal + freightAllocated + feesAllocated;

    // Two ways to settle: take the early-payment discount, or hold the cash to
    // the net date. Price both and keep the cheaper one.
    const earlyPayAmount = (invoiceSubtotal * clamp(terms.discountPct, 0, 100)) / 100;
    const cashIfEarly = invoiceTotal - earlyPayAmount;
    const effectiveIfEarly = cashIfEarly - cashIfEarly * dailyRate * Math.max(0, terms.discountDays);
    const effectiveIfNet = invoiceTotal - invoiceTotal * dailyRate * Math.max(0, terms.netDays);
    const takeEarly = terms.discountPct > 0 && effectiveIfEarly < effectiveIfNet;

    const earlyPaymentSaving = takeEarly ? earlyPayAmount : 0;
    const financingBenefit = takeEarly
      ? cashIfEarly * dailyRate * Math.max(0, terms.discountDays)
      : invoiceTotal * dailyRate * Math.max(0, terms.netDays);

    // Rebates are cash that arrives much later, and only if the threshold is
    // actually met — so both facts have to be priced in.
    const rebate = line.rebate ?? input.rebate ?? null;
    let rebateAmount = 0;
    let rebateQualified = true;
    let rebateShortfallUnits = 0;
    if (rebate && rebate.pct > 0) {
      const qtyBasis = rebate.scope === 'order' ? totalQuantity : line.quantity;
      const valueBasis = rebate.scope === 'order' ? goodsSubtotal : invoiceSubtotal;
      const qtyOk = rebate.thresholdQty ? qtyBasis >= rebate.thresholdQty : true;
      const valueOk = rebate.thresholdValue ? valueBasis >= rebate.thresholdValue : true;
      rebateQualified = qtyOk && valueOk;
      if (rebate.thresholdQty && !qtyOk) rebateShortfallUnits = rebate.thresholdQty - qtyBasis;
      if (rebateQualified) {
        const gross = (invoiceSubtotal * rebate.pct) / 100;
        const presentValueFactor = Math.max(0, 1 - dailyRate * Math.max(0, rebate.lagDays));
        rebateAmount = gross * presentValueFactor;
      }
    }

    const netLineCost = invoiceTotal - earlyPaymentSaving - financingBenefit - rebateAmount;
    const unitsTotal = line.unitsTotal || 1;
    const trueNetUnitCost = netLineCost / unitsTotal;
    const invoiceUnitCost = invoiceTotal / unitsTotal;
    const listUnitCost = line.quotedUnitPrice / line.packSize;

    const headlineDiscountPct = (1 - (1 - tier.pct / 100) * (1 - line.discountPct / 100)) * 100;
    const effectiveDiscountPct = line.grossTotal > 0 ? (1 - netLineCost / line.grossTotal) * 100 : 0;
    const discountGapPct = headlineDiscountPct - effectiveDiscountPct;

    const sellUnitPrice = line.sellUnitPrice && line.sellUnitPrice > 0 ? line.sellUnitPrice : null;
    const grossMarginPct = sellUnitPrice ? ((sellUnitPrice - listUnitCost) / sellUnitPrice) * 100 : null;
    const trueMarginPct = sellUnitPrice ? ((sellUnitPrice - trueNetUnitCost) / sellUnitPrice) * 100 : null;
    const marginPerUnit = sellUnitPrice ? sellUnitPrice - trueNetUnitCost : null;
    const marginTotal = marginPerUnit !== null ? marginPerUnit * unitsTotal : null;

    const benchmark = pickBenchmark(line, trueNetUnitCost, input.supplierName, history);

    const flags = buildLineFlags({
      line,
      options,
      currency,
      benchmark,
      trueNetUnitCost,
      unitsTotal,
      invoiceSubtotal,
      freightAllocated,
      feesAllocated,
      discountGapPct,
      headlineDiscountPct,
      rebate,
      rebateQualified,
      rebateShortfallUnits,
      trueMarginPct,
      sellUnitPrice,
      tierPct: tier.pct,
      supplierName: input.supplierName,
      history,
      listUnitCost,
    });

    return {
      index: line.index,
      description: line.description,
      sku: line.sku ?? null,
      productKey: line.key,
      quantity: round(line.quantity, 4),
      packSize: round(line.packSize, 4),
      uom: line.uom,
      unitsTotal: round(unitsTotal, 4),
      quotedUnitPrice: round(line.quotedUnitPrice, 4),
      listUnitCost: round(listUnitCost, 4),
      grossTotal: round(line.grossTotal),
      tierDiscountPct: round(tier.pct, 2),
      tierDiscountAmount: round(tierDiscountAmount),
      lineDiscountPct: round(line.discountPct, 2),
      lineDiscountAmount: round(lineDiscountAmount),
      invoiceSubtotal: round(invoiceSubtotal),
      freightAllocated: round(freightAllocated),
      feesAllocated: round(feesAllocated),
      invoiceTotal: round(invoiceTotal),
      earlyPaymentSaving: round(earlyPaymentSaving),
      financingBenefit: round(financingBenefit),
      rebateAmount: round(rebateAmount),
      rebateQualified,
      rebateShortfallUnits: round(rebateShortfallUnits, 2),
      netLineCost: round(netLineCost),
      trueNetUnitCost: round(trueNetUnitCost, 4),
      invoiceUnitCost: round(invoiceUnitCost, 4),
      headlineDiscountPct: round(headlineDiscountPct, 2),
      effectiveDiscountPct: round(effectiveDiscountPct, 2),
      discountGapPct: round(discountGapPct, 2),
      sellUnitPrice: sellUnitPrice ? round(sellUnitPrice, 4) : null,
      grossMarginPct: grossMarginPct === null ? null : round(grossMarginPct, 2),
      trueMarginPct: trueMarginPct === null ? null : round(trueMarginPct, 2),
      marginPerUnit: marginPerUnit === null ? null : round(marginPerUnit, 4),
      marginTotal: marginTotal === null ? null : round(marginTotal),
      benchmark: benchmark
        ? { ...benchmark, unitCost: round(benchmark.unitCost, 4), deltaPct: round(benchmark.deltaPct, 2) }
        : null,
      flags,
      confidence: round(line.confidence ?? 1, 2),
      score: scoreLine({ benchmark, discountGapPct, trueMarginPct, options, rebateQualified,
        hiddenShare: ratio(freightAllocated + feesAllocated, invoiceSubtotal) * 100 }),
    };
  });

  /* ---- order level ---------------------------------------------------- */

  const totals: OfferTotals = {
    grossTotal: round(sum(analyzed.map((l) => l.grossTotal))),
    discountTotal: round(sum(analyzed.map((l) => l.tierDiscountAmount + l.lineDiscountAmount))),
    invoiceSubtotal: round(sum(analyzed.map((l) => l.invoiceSubtotal))),
    freightTotal: round(freightTotal),
    feesTotal: round(sum(analyzed.map((l) => l.feesAllocated))),
    invoiceTotal: round(sum(analyzed.map((l) => l.invoiceTotal))),
    earlyPaymentSaving: round(sum(analyzed.map((l) => l.earlyPaymentSaving))),
    financingBenefit: round(sum(analyzed.map((l) => l.financingBenefit))),
    rebateTotal: round(sum(analyzed.map((l) => l.rebateAmount))),
    netTotal: round(sum(analyzed.map((l) => l.netLineCost))),
    headlineVsNet: 0,
    marginTotal: analyzed.every((l) => l.marginTotal === null)
      ? null
      : round(sum(analyzed.map((l) => l.marginTotal ?? 0))),
  };
  totals.headlineVsNet = round(totals.netTotal - (totals.grossTotal - totals.discountTotal));

  const orderFlags = buildOrderFlags({
    input,
    analyzed,
    options,
    currency,
    goodsSubtotal,
    freightTotal,
    freightWaived,
    orderFeesTotal,
    apr,
    history,
  });

  const allFlags = [...orderFlags, ...analyzed.flatMap((l) => l.flags)].sort(sortFlags);

  const paymentRecommendation = buildPaymentRecommendation(input, analyzed, apr, currency, options);

  const weighted = sum(analyzed.map((l) => l.score * Math.max(l.invoiceTotal, 1)));
  const weight = sum(analyzed.map((l) => Math.max(l.invoiceTotal, 1)));
  let score = analyzed.length === 0 ? 50 : weighted / weight;

  // Order-level flags adjust the score only for things the line scores do not
  // already price in. Freight and surcharges are allocated to every line, so
  // scoring the order-level hidden-cost flag as well would charge for them
  // twice. The flag still shows in the UI at full prominence.
  for (const flag of orderFlags) {
    if (SCORED_AT_LINE_LEVEL.has(flag.code)) continue;
    if (flag.severity === 'critical') score -= 5;
    else if (flag.severity === 'warning') score -= 3;
    else if (flag.severity === 'positive') score += 2;
  }
  score = clamp(Math.round(score), 0, 100);

  const verdict: Verdict = score >= 70 ? 'good' : score >= 45 ? 'review' : 'bad';

  const savingsIdentified = round(
    sum(
      allFlags
        .filter((f) => SAVINGS_FLAGS.has(f.code) && (f.impactAmount ?? 0) > 0)
        .map((f) => f.impactAmount ?? 0),
    ),
  );

  const asks = buildAsks(allFlags, analyzed, input, currency, options);

  return {
    supplierName: input.supplierName || 'Unnamed supplier',
    reference: input.reference ?? null,
    currency,
    quotedAt: input.quotedAt ?? new Date().toISOString(),
    lines: analyzed,
    totals,
    paymentTerms: terms,
    paymentRecommendation,
    freight,
    fees: input.fees ?? [],
    flags: allFlags,
    verdict,
    score,
    savingsIdentified,
    headline: buildHeadline(verdict, savingsIdentified, totals, currency),
    summary: buildSummary(analyzed, totals, allFlags, currency),
    asks,
    options,
  };
}

/** Codes whose cost is already reflected in the per-line scores. */
const SCORED_AT_LINE_LEVEL = new Set<FlagCode>(['hidden_cost', 'unqualified_rebate']);

const SAVINGS_FLAGS = new Set([
  'worse_than_last',
  'above_market',
  'hidden_cost',
  'unqualified_rebate',
  'take_early_payment',
  'freight_threshold_near',
  'list_price_increase',
]);

const SEVERITY_RANK: Record<Flag['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

function sortFlags(a: Flag, b: Flag): number {
  const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  return (b.impactAmount ?? 0) - (a.impactAmount ?? 0);
}

/* -------------------------------------------------------------------------- */
/*  Flags                                                                     */
/* -------------------------------------------------------------------------- */

interface LineFlagContext {
  line: NormalizedLine;
  options: AnalysisOptions;
  currency: string;
  benchmark: Benchmark | null;
  trueNetUnitCost: number;
  unitsTotal: number;
  invoiceSubtotal: number;
  freightAllocated: number;
  feesAllocated: number;
  discountGapPct: number;
  headlineDiscountPct: number;
  rebate: OfferInput['rebate'] | null;
  rebateQualified: boolean;
  rebateShortfallUnits: number;
  trueMarginPct: number | null;
  sellUnitPrice: number | null;
  tierPct: number;
  supplierName: string;
  history: HistoryPoint[];
  listUnitCost: number;
}

function buildLineFlags(ctx: LineFlagContext): Flag[] {
  const flags: Flag[] = [];
  const { line, options, currency, benchmark, trueNetUnitCost, unitsTotal } = ctx;
  const idx = line.index;

  if (benchmark) {
    const delta = benchmark.deltaPct;
    const impact = Math.abs(trueNetUnitCost - benchmark.unitCost) * unitsTotal;
    if (delta > options.materialityPct) {
      const worseThanSupplier = benchmark.source === 'supplier_history';
      flags.push({
        code: worseThanSupplier ? 'worse_than_last' : 'above_market',
        severity: delta >= 5 ? 'critical' : 'warning',
        title: worseThanSupplier
          ? `Worse than your last offer — ${line.description}`
          : `Above market — ${line.description}`,
        detail: worseThanSupplier
          ? `True net cost is ${formatUnitPrice(trueNetUnitCost, currency)}/${line.uom} versus ${formatUnitPrice(benchmark.unitCost, currency)} the last time ${benchmark.supplierName} quoted it (${formatPercent(delta)} higher). That is ${formatCurrency(impact, currency)} more on this order.`
          : `True net cost is ${formatPercent(delta)} above the ${formatUnitPrice(benchmark.unitCost, currency)}/${line.uom} median you pay elsewhere${benchmark.supplierName ? ` (best: ${benchmark.supplierName})` : ''}. Worth ${formatCurrency(impact, currency)} on this order.`,
        impactAmount: round(impact),
        lineIndex: idx,
      });
    } else if (delta < -options.materialityPct) {
      flags.push({
        code: benchmark.source === 'supplier_history' ? 'better_than_last' : 'below_market',
        severity: 'positive',
        title: `Below your benchmark — ${line.description}`,
        detail: `True net cost is ${formatPercent(Math.abs(delta))} below your reference of ${formatUnitPrice(benchmark.unitCost, currency)}/${line.uom}, saving ${formatCurrency(impact, currency)} on this order.`,
        impactAmount: round(impact),
        lineIndex: idx,
      });
    }

    // A bigger discount on a higher list price is still a price rise.
    const last = lastListPriceFor(line, ctx.supplierName, ctx.history);
    if (last && last.listUnitCost > 0) {
      const listDelta = pctDelta(ctx.listUnitCost, last.listUnitCost);
      if (listDelta > 1 && ctx.headlineDiscountPct > 0) {
        flags.push({
          code: 'list_price_increase',
          severity: 'warning',
          title: `List price up ${formatPercent(listDelta)} — ${line.description}`,
          detail: `The list price moved from ${formatUnitPrice(last.listUnitCost, currency)} to ${formatUnitPrice(ctx.listUnitCost, currency)} per ${line.uom} before the ${formatPercent(ctx.headlineDiscountPct)} discount is applied. Ask for the discount off the old list.`,
          impactAmount: round((ctx.listUnitCost - last.listUnitCost) * unitsTotal),
          lineIndex: idx,
        });
      }
    }
  }

  const hiddenAmount = ctx.freightAllocated + ctx.feesAllocated;
  const hiddenShare = ratio(hiddenAmount, ctx.invoiceSubtotal) * 100;
  if (hiddenShare > options.hiddenCostThresholdPct) {
    const excess = hiddenAmount - (ctx.invoiceSubtotal * options.hiddenCostThresholdPct) / 100;
    flags.push({
      code: 'hidden_cost',
      severity: hiddenShare > 8 ? 'critical' : 'warning',
      title: `Hidden cost: freight and fees add ${formatPercent(hiddenShare)} — ${line.description}`,
      detail: `${formatCurrency(hiddenAmount, currency)} of freight and surcharges is allocated to this line but appears nowhere in the quoted unit price. It pushes the real cost from ${formatUnitPrice(ctx.invoiceSubtotal / unitsTotal, currency)} to ${formatUnitPrice((ctx.invoiceSubtotal + hiddenAmount) / unitsTotal, currency)} per ${line.uom}.`,
      impactAmount: round(Math.max(0, excess)),
      lineIndex: idx,
    });
  }

  if (ctx.discountGapPct > 2 && ctx.headlineDiscountPct >= 3) {
    flags.push({
      code: 'discount_theater',
      severity: 'info',
      title: `Headline ${formatPercent(ctx.headlineDiscountPct)} is really ${formatPercent(ctx.headlineDiscountPct - ctx.discountGapPct)} — ${line.description}`,
      detail: `After freight, surcharges and the timing of the rebate, the ${formatPercent(ctx.headlineDiscountPct)} discount is worth ${formatPercent(ctx.headlineDiscountPct - ctx.discountGapPct)} against the list price.`,
      lineIndex: idx,
    });
  }

  if (ctx.rebate && ctx.rebate.pct > 0 && !ctx.rebateQualified) {
    const forgone = (ctx.invoiceSubtotal * ctx.rebate.pct) / 100;
    flags.push({
      code: 'unqualified_rebate',
      severity: 'warning',
      title: `Rebate does not apply at this volume — ${line.description}`,
      detail: ctx.rebateShortfallUnits > 0
        ? `The ${formatPercent(ctx.rebate.pct)} rebate needs ${Math.ceil(ctx.rebateShortfallUnits)} more ${plural(Math.ceil(ctx.rebateShortfallUnits), 'unit')} than you are ordering, so the quote's effective price assumes money you will not receive. It is worth ${formatCurrency(forgone, currency)}.`
        : `The ${formatPercent(ctx.rebate.pct)} rebate threshold is not met by this order, so the ${formatCurrency(forgone, currency)} it implies is not real money yet.`,
      impactAmount: round(forgone),
      lineIndex: idx,
    });
  } else if (ctx.rebate && ctx.rebate.thresholdQty && ctx.rebateQualified) {
    const headroom = line.quantity - ctx.rebate.thresholdQty;
    if (headroom >= 0 && headroom <= ctx.rebate.thresholdQty * 0.05) {
      flags.push({
        code: 'rebate_near_threshold',
        severity: 'info',
        title: `Only ${round(headroom, 1)} units above the rebate threshold — ${line.description}`,
        detail: `Any short-ship drops you below ${ctx.rebate.thresholdQty} units and costs the whole ${formatPercent(ctx.rebate.pct)} rebate. Ask for the threshold in writing at your order size.`,
        lineIndex: idx,
      });
    }
  }

  // Worth telling the buyer about a break they could realistically top up to.
  const upgrade = nextTier(line, ctx.tierPct);
  if (upgrade && upgrade.minQty <= line.quantity * 1.25 + 1e-9) {
    const extraUnits = upgrade.minQty - line.quantity;
    const saving = (line.grossTotal * (upgrade.pct - ctx.tierPct)) / 100;
    flags.push({
      code: 'rebate_near_threshold',
      severity: 'info',
      title: `${round(extraUnits, 1)} more units unlocks ${formatPercent(upgrade.pct)} — ${line.description}`,
      detail: `You are ordering ${round(line.quantity, 1)}; the next break starts at ${upgrade.minQty}. Taking it is worth about ${formatCurrency(saving, currency)}, or ask the supplier to apply the break at your current volume.`,
      impactAmount: round(saving),
      lineIndex: idx,
    });
  }

  if (ctx.trueMarginPct !== null) {
    if (ctx.trueMarginPct < 0) {
      flags.push({
        code: 'negative_margin',
        severity: 'critical',
        title: `You lose money on every unit — ${line.description}`,
        detail: `True net cost of ${formatUnitPrice(trueNetUnitCost, currency)} is above your ${formatUnitPrice(ctx.sellUnitPrice ?? 0, currency)} sell price. Every ${line.uom} sold loses ${formatCurrency(trueNetUnitCost - (ctx.sellUnitPrice ?? 0), currency)}.`,
        impactAmount: round(Math.abs((ctx.sellUnitPrice ?? 0) - trueNetUnitCost) * unitsTotal),
        lineIndex: idx,
      });
    } else if (ctx.trueMarginPct < ctx.options.targetMarginPct) {
      flags.push({
        code: 'thin_margin',
        severity: 'warning',
        title: `Margin of ${formatPercent(ctx.trueMarginPct)} is under your ${formatPercent(ctx.options.targetMarginPct, 0)} target — ${line.description}`,
        detail: `At ${formatUnitPrice(trueNetUnitCost, currency)} true net cost you need ${formatUnitPrice((ctx.sellUnitPrice ?? 0) === 0 ? 0 : trueNetUnitCost / (1 - ctx.options.targetMarginPct / 100), currency)} on the shelf to hit target, or ${formatUnitPrice(trueNetUnitCost - ((ctx.sellUnitPrice ?? 0) * ctx.options.targetMarginPct) / 100 > 0 ? (ctx.sellUnitPrice ?? 0) * (1 - ctx.options.targetMarginPct / 100) : 0, currency)} from the supplier.`,
        lineIndex: idx,
      });
    }
  }

  if ((line.confidence ?? 1) < 0.6) {
    flags.push({
      code: 'low_confidence',
      severity: 'info',
      title: `Check the parsed values — ${line.description}`,
      detail: 'This line was read from an awkward layout and may need a correction before you rely on the numbers.',
      lineIndex: idx,
    });
  }

  return flags.sort(sortFlags);
}

interface OrderFlagContext {
  input: OfferInput;
  analyzed: LineAnalysis[];
  options: AnalysisOptions;
  currency: string;
  goodsSubtotal: number;
  freightTotal: number;
  freightWaived: boolean;
  orderFeesTotal: number;
  apr: number | null;
  history: HistoryPoint[];
}

function buildOrderFlags(ctx: OrderFlagContext): Flag[] {
  const flags: Flag[] = [];
  const { input, currency, goodsSubtotal, freightTotal, freightWaived, apr, options } = ctx;
  const freight = input.freight;

  if (
    !freightWaived &&
    freight.freeAboveOrderValue !== null &&
    goodsSubtotal > 0 &&
    goodsSubtotal >= freight.freeAboveOrderValue * 0.85
  ) {
    const gap = freight.freeAboveOrderValue - goodsSubtotal;
    flags.push({
      code: 'freight_threshold_near',
      severity: 'warning',
      title: `${formatCurrency(gap, currency)} away from free freight`,
      detail: `Freight is waived above ${formatCurrency(freight.freeAboveOrderValue, currency)} and this order is ${formatCurrency(goodsSubtotal, currency)}. Adding ${formatCurrency(gap, currency)} of stock you will buy anyway saves the ${formatCurrency(freight.flatPerOrder, currency)} delivery charge — or ask them to waive it.`,
      impactAmount: round(freight.flatPerOrder),
    });
  }

  if (apr !== null && apr > options.costOfCapitalPct + 5) {
    flags.push({
      code: 'take_early_payment',
      severity: 'info',
      title: `Early payment is worth ${formatPercent(apr, 0)} annualised`,
      detail: `${input.paymentTerms.discountPct}% for paying ${input.paymentTerms.netDays - input.paymentTerms.discountDays} days sooner beats your ${formatPercent(options.costOfCapitalPct, 0)} cost of capital. Take the discount if cash allows.`,
      impactAmount: round((goodsSubtotal * input.paymentTerms.discountPct) / 100),
    });
  }

  // Terms are a price. If this supplier used to give longer, that is a cut.
  const previousTerms = ctx.history
    .filter((p) => p.supplierName.trim().toLowerCase() === input.supplierName.trim().toLowerCase())
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
  if (previousTerms && previousTerms.netDays > input.paymentTerms.netDays) {
    const lostDays = previousTerms.netDays - input.paymentTerms.netDays;
    const carryCost = goodsSubtotal * (options.costOfCapitalPct / 100 / 365) * lostDays;
    flags.push({
      code: 'terms_worse',
      severity: 'warning',
      title: `Payment terms cut from net ${previousTerms.netDays} to net ${input.paymentTerms.netDays}`,
      detail: `Losing ${lostDays} days of free credit on ${formatCurrency(goodsSubtotal, currency)} costs about ${formatCurrency(carryCost, currency)} at your ${formatPercent(options.costOfCapitalPct, 0)} cost of capital. That is a price increase in disguise.`,
      impactAmount: round(carryCost),
    });
  }

  const hiddenTotal = freightTotal + ctx.orderFeesTotal;
  if (goodsSubtotal > 0 && (hiddenTotal / goodsSubtotal) * 100 > options.hiddenCostThresholdPct * 2) {
    flags.push({
      code: 'hidden_cost',
      severity: 'critical',
      title: `Freight and fees are ${formatPercent((hiddenTotal / goodsSubtotal) * 100)} of the order`,
      detail: `${formatCurrency(hiddenTotal, currency)} sits outside the quoted prices${
        input.fees.length ? `: ${input.fees.map((f) => f.label).join(', ')}` : ''
      }. Ask for delivered pricing so the comparison is apples to apples.`,
      impactAmount: round(hiddenTotal),
    });
  }

  return flags;
}

/* -------------------------------------------------------------------------- */
/*  Scoring, narrative, asks                                                  */
/* -------------------------------------------------------------------------- */

function scoreLine(args: {
  benchmark: Benchmark | null;
  discountGapPct: number;
  trueMarginPct: number | null;
  options: AnalysisOptions;
  rebateQualified: boolean;
  hiddenShare: number;
}): number {
  const { benchmark, discountGapPct, trueMarginPct, options, rebateQualified, hiddenShare } = args;
  let score = 72;

  if (benchmark) {
    // Positive delta = more expensive than the benchmark.
    score -= clamp(benchmark.deltaPct * 3, -25, 45);
  }
  // The gap between headline and effective discount is mostly caused by freight
  // and surcharges, which the hidden-cost term below already charges for. It is
  // kept, but small, so it only adds weight for rebate timing and thresholds.
  score -= clamp(discountGapPct * 0.75, 0, 8);
  score -= clamp((hiddenShare - options.hiddenCostThresholdPct) * 2, 0, 18);
  if (!rebateQualified) score -= 10;

  if (trueMarginPct !== null) {
    if (trueMarginPct < 0) score -= 30;
    else if (trueMarginPct < options.targetMarginPct) {
      score -= clamp((options.targetMarginPct - trueMarginPct) * 0.8, 0, 15);
    } else if (trueMarginPct > options.targetMarginPct + 10) score += 5;
  }

  return clamp(Math.round(score), 0, 100);
}

function buildPaymentRecommendation(
  input: OfferInput,
  lines: LineAnalysis[],
  apr: number | null,
  currency: string,
  options: AnalysisOptions,
): PaymentRecommendation {
  const savingIfTaken = round(
    sum(lines.map((l) => (l.invoiceSubtotal * input.paymentTerms.discountPct) / 100)),
  );
  const takes = lines.some((l) => l.earlyPaymentSaving > 0);
  if (input.paymentTerms.discountPct <= 0) {
    return {
      action: 'pay_at_terms',
      impliedApr: null,
      savingIfTaken: 0,
      detail: `No early-payment discount is offered. Hold the cash for the full net ${input.paymentTerms.netDays} days — the free credit is worth ${formatCurrency(
        sum(lines.map((l) => l.financingBenefit)),
        currency,
      )} on this order.`,
    };
  }
  if (takes) {
    return {
      action: 'take_discount',
      impliedApr: apr === null ? null : round(apr, 1),
      savingIfTaken,
      detail: `Pay within ${input.paymentTerms.discountDays} days and take ${formatCurrency(savingIfTaken, currency)} off. That is ${
        apr === null ? 'a strong return' : `${formatPercent(apr, 0)} annualised`
      }, well above your ${formatPercent(options.costOfCapitalPct, 0)} cost of capital.`,
    };
  }
  return {
    action: 'pay_at_terms',
    impliedApr: apr === null ? null : round(apr, 1),
    savingIfTaken,
    detail: `The ${input.paymentTerms.discountPct}% early-payment discount is worth less than holding the cash to day ${input.paymentTerms.netDays} at your ${formatPercent(options.costOfCapitalPct, 0)} cost of capital. Pay at terms.`,
  };
}

function buildHeadline(
  verdict: Verdict,
  savings: number,
  totals: OfferTotals,
  currency: string,
): string {
  const net = formatCurrency(totals.netTotal, currency);
  switch (verdict) {
    case 'good':
      return `Good deal — true net ${net}${savings > 0 ? `, with ${formatCurrency(savings, currency)} still on the table` : ''}`;
    case 'review':
      return `Review before signing — ${formatCurrency(savings, currency)} of this offer needs a conversation`;
    default:
      return `Bad deal — ${formatCurrency(savings, currency)} worse than it should be`;
  }
}

function buildSummary(
  lines: LineAnalysis[],
  totals: OfferTotals,
  flags: Flag[],
  currency: string,
): string {
  const parts: string[] = [];
  const quoted = totals.grossTotal - totals.discountTotal;
  parts.push(
    `The quote invoices at ${formatCurrency(totals.invoiceTotal, currency)} and settles at a true net of ${formatCurrency(
      totals.netTotal,
      currency,
    )} once freight, surcharges, rebate timing and payment terms are priced in — ${formatCurrency(
      Math.abs(totals.netTotal - quoted),
      currency,
    )} ${totals.netTotal > quoted ? 'more' : 'less'} than the discounted line prices suggest.`,
  );

  const worse = flags.filter((f) => f.code === 'worse_than_last' || f.code === 'above_market');
  if (worse.length > 0) {
    parts.push(
      `${worse.length} ${worse.length === 1 ? 'line is' : 'lines are'} priced above your benchmark, worth ${formatCurrency(
        sum(worse.map((f) => f.impactAmount ?? 0)),
        currency,
      )}.`,
    );
  }
  const hidden = flags.filter((f) => f.code === 'hidden_cost');
  if (hidden.length > 0) {
    parts.push(`Freight and surcharges are material and are not in the quoted unit prices.`);
  }
  const rebate = flags.filter((f) => f.code === 'unqualified_rebate');
  if (rebate.length > 0) {
    parts.push(`A rebate in the offer does not qualify at the volumes quoted.`);
  }
  if (lines.length > 0 && totals.marginTotal !== null) {
    parts.push(`Margin on the order is ${formatCurrency(totals.marginTotal, currency)}.`);
  }
  return parts.join(' ');
}

function buildAsks(
  flags: Flag[],
  lines: LineAnalysis[],
  input: OfferInput,
  currency: string,
  options: AnalysisOptions,
): CounterAsk[] {
  const asks: CounterAsk[] = [];

  for (const flag of flags) {
    if (flag.code === 'worse_than_last' || flag.code === 'above_market') {
      const line = lines[flag.lineIndex ?? -1];
      if (!line || !line.benchmark) continue;
      asks.push({
        code: `price:${line.index}`,
        ask: `Hold ${line.description} at ${formatUnitPrice(line.benchmark.unitCost, currency)} per ${line.uom} net of freight and rebate (you have quoted ${formatUnitPrice(line.trueNetUnitCost, currency)}).`,
        rationale:
          line.benchmark.source === 'supplier_history'
            ? `Your own last price on this line.`
            : `The median we currently pay across suppliers.`,
        value: flag.impactAmount ?? 0,
      });
    }
    if (flag.code === 'hidden_cost' && flag.lineIndex === undefined) {
      asks.push({
        code: 'freight',
        ask: `Quote delivered pricing with freight and surcharges included, or waive the ${formatCurrency(
          input.freight.flatPerOrder,
          currency,
        )} delivery charge at our standing order size.`,
        rationale: 'Surcharges outside the unit price make offers impossible to compare.',
        value: flag.impactAmount ?? 0,
      });
    }
    if (flag.code === 'unqualified_rebate') {
      const line = lines[flag.lineIndex ?? -1];
      asks.push({
        code: `rebate:${flag.lineIndex}`,
        ask: `Apply the rebate at the volume we actually order${
          line ? ` (${Math.round(line.quantity)} ${plural(Math.round(line.quantity), 'unit')})` : ''
        }, or drop the equivalent percentage into the invoice price.`,
        rationale: 'A rebate we cannot reach is not a discount.',
        value: flag.impactAmount ?? 0,
      });
    }
    if (flag.code === 'terms_worse') {
      asks.push({
        code: 'terms',
        ask: `Restore net ${Math.max(input.paymentTerms.netDays, 30)} payment terms, or add ${
          input.paymentTerms.discountPct > 0 ? `a further` : `a`
        } 2% early-payment discount to compensate.`,
        rationale: 'Shorter terms are a price increase in disguise.',
        value: flag.impactAmount ?? 0,
      });
    }
    if (flag.code === 'freight_threshold_near') {
      asks.push({
        code: 'freight_threshold',
        ask: `Confirm free delivery at our regular order size rather than the ${formatCurrency(
          input.freight.freeAboveOrderValue ?? 0,
          currency,
        )} threshold.`,
        rationale: 'We order consistently; the threshold only costs us on small weeks.',
        value: flag.impactAmount ?? 0,
      });
    }
    if (flag.code === 'list_price_increase') {
      const line = lines[flag.lineIndex ?? -1];
      asks.push({
        code: `list:${flag.lineIndex}`,
        ask: `Apply the new discount to the previous list price on ${line?.description ?? 'the affected line'} — the increase cancels most of the discount.`,
        rationale: 'A higher list with a bigger discount is not an improvement.',
        value: flag.impactAmount ?? 0,
      });
    }
  }

  const thin = lines.filter((l) => l.trueMarginPct !== null && l.trueMarginPct < options.targetMarginPct);
  if (thin.length > 0) {
    const worst = thin.slice().sort((a, b) => (a.trueMarginPct ?? 0) - (b.trueMarginPct ?? 0))[0];
    const target = worst.sellUnitPrice ? worst.sellUnitPrice * (1 - options.targetMarginPct / 100) : 0;
    asks.push({
      code: 'margin',
      ask: `Get ${worst.description} to ${formatUnitPrice(target, currency)} per ${worst.uom} delivered so it clears our ${formatPercent(options.targetMarginPct, 0)} margin floor.`,
      rationale: `At the quoted price it returns ${formatPercent(worst.trueMarginPct)}.`,
      value: round(((worst.trueNetUnitCost - target) * worst.unitsTotal) || 0),
    });
  }

  // Deduplicate by code, keeping the highest-value version of each ask.
  const byCode = new Map<string, CounterAsk>();
  for (const ask of asks) {
    const existing = byCode.get(ask.code);
    if (!existing || ask.value > existing.value) byCode.set(ask.code, ask);
  }
  return Array.from(byCode.values()).sort((a, b) => b.value - a.value);
}
