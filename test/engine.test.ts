import { describe, expect, it } from 'vitest';
import { analyzeOffer, impliedApr } from '@/lib/analysis/engine';
import type { HistoryPoint, OfferInput } from '@/lib/types';

function baseOffer(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    supplierName: 'Northside Food Supply',
    reference: 'Q-4417',
    currency: 'USD',
    quotedAt: '2026-08-01T00:00:00.000Z',
    lines: [
      {
        description: 'Mozzarella 2.5kg block',
        sku: 'MOZ-25',
        quantity: 100,
        packSize: 1,
        uom: 'block',
        quotedUnitPrice: 20,
        discountPct: 0,
        tiers: [],
      },
    ],
    paymentTerms: { netDays: 30, discountPct: 0, discountDays: 0 },
    freight: { flatPerOrder: 0, perUnit: 0, freeAboveOrderValue: null, allocation: 'value' },
    fees: [],
    ...overrides,
  };
}

const ZERO_CAPITAL = { costOfCapitalPct: 0 };

describe('analyzeOffer — base arithmetic', () => {
  it('returns the quoted price as true net cost when nothing else is going on', () => {
    const result = analyzeOffer(baseOffer(), [], ZERO_CAPITAL);
    const line = result.lines[0];
    expect(line.grossTotal).toBe(2000);
    expect(line.invoiceTotal).toBe(2000);
    expect(line.trueNetUnitCost).toBe(20);
    expect(result.totals.netTotal).toBe(2000);
  });

  it('normalises pack size into a per-unit cost', () => {
    const offer = baseOffer({
      lines: [
        {
          description: 'Cola 330ml can',
          quantity: 50,
          packSize: 24,
          uom: 'can',
          quotedUnitPrice: 12,
          discountPct: 0,
          tiers: [],
        },
      ],
    });
    const line = analyzeOffer(offer, [], ZERO_CAPITAL).lines[0];
    expect(line.unitsTotal).toBe(1200);
    expect(line.listUnitCost).toBe(0.5);
    expect(line.trueNetUnitCost).toBe(0.5);
  });

  it('applies tier and line discounts sequentially, not additively', () => {
    const offer = baseOffer({
      lines: [
        {
          description: 'Mozzarella 2.5kg block',
          quantity: 100,
          packSize: 1,
          uom: 'block',
          quotedUnitPrice: 20,
          discountPct: 10,
          tiers: [{ minQty: 50, discountPct: 10 }],
        },
      ],
    });
    const line = analyzeOffer(offer, [], ZERO_CAPITAL).lines[0];
    // 2000 -> 1800 (tier) -> 1620 (line). Additive would have given 1600.
    expect(line.invoiceSubtotal).toBe(1620);
    expect(line.headlineDiscountPct).toBe(19);
  });

  it('only honours a volume tier the order actually reaches', () => {
    const offer = baseOffer({
      lines: [
        {
          description: 'Mozzarella 2.5kg block',
          quantity: 40,
          packSize: 1,
          uom: 'block',
          quotedUnitPrice: 20,
          discountPct: 0,
          tiers: [
            { minQty: 50, discountPct: 10 },
            { minQty: 200, discountPct: 18 },
          ],
        },
      ],
    });
    const line = analyzeOffer(offer, [], ZERO_CAPITAL).lines[0];
    expect(line.tierDiscountPct).toBe(0);
    expect(line.flags.some((f) => f.title.includes('unlocks'))).toBe(true);
  });
});

describe('analyzeOffer — freight and fees', () => {
  it('allocates order freight across lines by value and conserves the total', () => {
    const offer = baseOffer({
      lines: [
        { description: 'Item A', quantity: 100, packSize: 1, uom: 'case', quotedUnitPrice: 30, discountPct: 0, tiers: [] },
        { description: 'Item B', quantity: 100, packSize: 1, uom: 'case', quotedUnitPrice: 10, discountPct: 0, tiers: [] },
      ],
      freight: { flatPerOrder: 400, perUnit: 0, freeAboveOrderValue: null, allocation: 'value' },
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    expect(result.lines[0].freightAllocated).toBe(300);
    expect(result.lines[1].freightAllocated).toBe(100);
    expect(result.totals.freightTotal).toBe(400);
    expect(result.totals.invoiceTotal).toBe(4400);
  });

  it('allocates by quantity when asked to', () => {
    const offer = baseOffer({
      lines: [
        { description: 'Item A', quantity: 150, packSize: 1, uom: 'case', quotedUnitPrice: 30, discountPct: 0, tiers: [] },
        { description: 'Item B', quantity: 50, packSize: 1, uom: 'case', quotedUnitPrice: 10, discountPct: 0, tiers: [] },
      ],
      freight: { flatPerOrder: 400, perUnit: 0, freeAboveOrderValue: null, allocation: 'quantity' },
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    expect(result.lines[0].freightAllocated).toBe(300);
    expect(result.lines[1].freightAllocated).toBe(100);
  });

  it('waives the flat charge above the free-freight threshold', () => {
    const offer = baseOffer({
      freight: { flatPerOrder: 145, perUnit: 0, freeAboveOrderValue: 1500, allocation: 'value' },
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    expect(result.totals.freightTotal).toBe(0);
  });

  it('flags an order sitting just under the free-freight threshold', () => {
    const offer = baseOffer({
      lines: [
        { description: 'Item A', quantity: 70, packSize: 1, uom: 'case', quotedUnitPrice: 20, discountPct: 0, tiers: [] },
      ],
      freight: { flatPerOrder: 145, perUnit: 0, freeAboveOrderValue: 1500, allocation: 'value' },
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    const flag = result.flags.find((f) => f.code === 'freight_threshold_near');
    expect(flag).toBeDefined();
    expect(flag?.impactAmount).toBe(145);
  });

  it('turns a percent-of-goods surcharge into real money and flags it', () => {
    const offer = baseOffer({
      fees: [{ label: 'Fuel surcharge', amount: 4, basis: 'percent_of_goods' }],
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    expect(result.totals.feesTotal).toBe(80);
    expect(result.flags.some((f) => f.code === 'hidden_cost')).toBe(true);
  });
});

describe('analyzeOffer — payment terms', () => {
  it('computes the implied APR of an early-payment discount', () => {
    expect(impliedApr(2, 10, 30)).toBeCloseTo(37.24, 1);
    expect(impliedApr(0, 10, 30)).toBeNull();
    expect(impliedApr(2, 30, 30)).toBeNull();
  });

  it('takes a 2/10 net 30 discount at a normal cost of capital', () => {
    const offer = baseOffer({ paymentTerms: { netDays: 30, discountPct: 2, discountDays: 10 } });
    const result = analyzeOffer(offer, [], { costOfCapitalPct: 12 });
    expect(result.paymentRecommendation.action).toBe('take_discount');
    expect(result.totals.earlyPaymentSaving).toBe(40);
    // 1960 held for 10 days at 12%/yr.
    expect(result.totals.financingBenefit).toBeCloseTo(6.44, 1);
    expect(result.totals.netTotal).toBeCloseTo(1953.56, 1);
  });

  it('declines a thin discount when capital is expensive enough to hold', () => {
    const offer = baseOffer({ paymentTerms: { netDays: 90, discountPct: 0.25, discountDays: 10 } });
    const result = analyzeOffer(offer, [], { costOfCapitalPct: 40 });
    expect(result.paymentRecommendation.action).toBe('pay_at_terms');
    expect(result.totals.earlyPaymentSaving).toBe(0);
  });

  it('values the free credit in long terms', () => {
    const offer = baseOffer({ paymentTerms: { netDays: 60, discountPct: 0, discountDays: 0 } });
    const result = analyzeOffer(offer, [], { costOfCapitalPct: 12 });
    // 2000 * 12%/365 * 60 = 39.45
    expect(result.totals.financingBenefit).toBeCloseTo(39.45, 1);
    expect(result.totals.netTotal).toBeCloseTo(1960.55, 1);
  });
});

describe('analyzeOffer — rebates', () => {
  it('discounts a rebate for the time it takes to arrive', () => {
    const offer = baseOffer({
      rebate: { pct: 5, lagDays: 90, scope: 'order', thresholdQty: 50 },
    });
    const result = analyzeOffer(offer, [], { costOfCapitalPct: 12 });
    // 5% of 2000 = 100, discounted by 12%/365*90 = 2.96%.
    expect(result.totals.rebateTotal).toBeCloseTo(97.04, 1);
  });

  it('refuses to count a rebate the order does not qualify for', () => {
    const offer = baseOffer({
      rebate: { pct: 5, lagDays: 90, scope: 'order', thresholdQty: 500 },
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    expect(result.totals.rebateTotal).toBe(0);
    const flag = result.flags.find((f) => f.code === 'unqualified_rebate');
    expect(flag).toBeDefined();
    expect(flag?.impactAmount).toBe(100);
    expect(flag?.detail).toContain('400 more');
  });
});

describe('analyzeOffer — benchmarking', () => {
  const history: HistoryPoint[] = [
    {
      offerId: 'o1',
      productKey: 'sku:moz25',
      description: 'Mozzarella 2.5kg block',
      sku: 'MOZ-25',
      supplierId: 's1',
      supplierName: 'Northside Food Supply',
      trueNetUnitCost: 18,
      listUnitCost: 18,
      packSize: 1,
      occurredAt: '2026-06-01T00:00:00.000Z',
      netDays: 30,
    },
  ];

  it('flags an offer that is worse than the same supplier last time', () => {
    const result = analyzeOffer(baseOffer(), history, ZERO_CAPITAL);
    const flag = result.flags.find((f) => f.code === 'worse_than_last');
    expect(flag).toBeDefined();
    // 100 units, $2 worse each.
    expect(flag?.impactAmount).toBe(200);
    expect(result.lines[0].benchmark?.deltaPct).toBeCloseTo(11.11, 1);
    expect(result.verdict).not.toBe('good');
    expect(result.savingsIdentified).toBeGreaterThanOrEqual(200);
  });

  it('celebrates an offer that beats the last one', () => {
    const offer = baseOffer();
    offer.lines[0].quotedUnitPrice = 16;
    const result = analyzeOffer(offer, history, ZERO_CAPITAL);
    expect(result.flags.some((f) => f.code === 'better_than_last')).toBe(true);
    expect(result.verdict).toBe('good');
  });

  it('compares against other suppliers when this one is new', () => {
    const result = analyzeOffer(
      baseOffer({ supplierName: 'Harbour Wholesale' }),
      history,
      ZERO_CAPITAL,
    );
    const line = result.lines[0];
    expect(line.benchmark?.source).toBe('cross_supplier');
    expect(result.flags.some((f) => f.code === 'above_market')).toBe(true);
  });

  it('matches products across spelling differences', () => {
    const offer = baseOffer();
    offer.lines[0].sku = null;
    offer.lines[0].description = 'MOZZARELLA BLOCK 2.5 KG';
    const noSkuHistory = history.map((h) => ({ ...h, sku: null, productKey: 'block-kg-mozzarella-2.5' }));
    const result = analyzeOffer(offer, noSkuHistory, ZERO_CAPITAL);
    expect(result.lines[0].benchmark).not.toBeNull();
  });

  it('flags a list price rise hiding behind a bigger discount', () => {
    const offer = baseOffer({
      lines: [
        {
          description: 'Mozzarella 2.5kg block',
          sku: 'MOZ-25',
          quantity: 100,
          packSize: 1,
          uom: 'block',
          quotedUnitPrice: 22,
          discountPct: 12,
          tiers: [],
        },
      ],
    });
    const result = analyzeOffer(offer, history, ZERO_CAPITAL);
    expect(result.flags.some((f) => f.code === 'list_price_increase')).toBe(true);
  });

  it('flags payment terms being quietly shortened', () => {
    const offer = baseOffer({ paymentTerms: { netDays: 15, discountPct: 0, discountDays: 0 } });
    const result = analyzeOffer(offer, history, { costOfCapitalPct: 12 });
    expect(result.flags.some((f) => f.code === 'terms_worse')).toBe(true);
  });
});

describe('analyzeOffer — margin', () => {
  it('separates headline margin from true margin', () => {
    const offer = baseOffer({
      lines: [
        {
          description: 'Mozzarella 2.5kg block',
          quantity: 100,
          packSize: 1,
          uom: 'block',
          quotedUnitPrice: 20,
          discountPct: 0,
          tiers: [],
          sellUnitPrice: 30,
        },
      ],
      freight: { flatPerOrder: 300, perUnit: 0, freeAboveOrderValue: null, allocation: 'value' },
    });
    const line = analyzeOffer(offer, [], ZERO_CAPITAL).lines[0];
    expect(line.grossMarginPct).toBeCloseTo(33.33, 1);
    expect(line.trueNetUnitCost).toBe(23);
    expect(line.trueMarginPct).toBeCloseTo(23.33, 1);
    expect(line.marginTotal).toBe(700);
  });

  it('calls out a line that loses money on every unit', () => {
    const offer = baseOffer({
      lines: [
        {
          description: 'Loss leader',
          quantity: 100,
          packSize: 1,
          uom: 'case',
          quotedUnitPrice: 20,
          discountPct: 0,
          tiers: [],
          sellUnitPrice: 19,
        },
      ],
    });
    const result = analyzeOffer(offer, [], ZERO_CAPITAL);
    expect(result.flags.some((f) => f.code === 'negative_margin')).toBe(true);
    expect(result.verdict).toBe('bad');
  });
});

describe('analyzeOffer — verdict and asks', () => {
  it('produces specific, priced asks for a bad offer', () => {
    const offer = baseOffer({
      freight: { flatPerOrder: 250, perUnit: 0, freeAboveOrderValue: null, allocation: 'value' },
      rebate: { pct: 4, lagDays: 90, scope: 'order', thresholdQty: 400 },
    });
    const history: HistoryPoint[] = [
      {
        offerId: 'o1',
        productKey: 'sku:moz25',
        description: 'Mozzarella 2.5kg block',
        sku: 'MOZ-25',
        supplierId: 's1',
        supplierName: 'Northside Food Supply',
        trueNetUnitCost: 17.5,
        listUnitCost: 18,
        packSize: 1,
        occurredAt: '2026-06-01T00:00:00.000Z',
        netDays: 30,
      },
    ];
    const result = analyzeOffer(offer, history, ZERO_CAPITAL);
    expect(result.verdict).toBe('bad');
    expect(result.asks.length).toBeGreaterThanOrEqual(2);
    expect(result.asks.some((a) => a.code.startsWith('price:'))).toBe(true);
    expect(result.asks.some((a) => a.code.startsWith('rebate:'))).toBe(true);
    expect(result.asks[0].value).toBeGreaterThan(0);
  });

  it('handles an empty offer without throwing', () => {
    const result = analyzeOffer(baseOffer({ lines: [] }), [], ZERO_CAPITAL);
    expect(result.lines).toHaveLength(0);
    expect(result.totals.netTotal).toBe(0);
    expect(['good', 'review', 'bad']).toContain(result.verdict);
  });

  it('never divides by zero on a zero-quantity line', () => {
    const offer = baseOffer({
      lines: [
        { description: 'Ghost line', quantity: 0, packSize: 1, uom: 'case', quotedUnitPrice: 10, discountPct: 0, tiers: [] },
      ],
    });
    const line = analyzeOffer(offer, [], ZERO_CAPITAL).lines[0];
    expect(Number.isFinite(line.trueNetUnitCost)).toBe(true);
  });
});
