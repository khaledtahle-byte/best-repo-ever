import type { HistoryPoint, OfferInput } from '@/lib/types';

/**
 * A realistic mid-size restaurant order. Used on the marketing page and by the
 * "try a sample" button, so the numbers shown anywhere in the product are
 * produced by the same engine that analyses a real upload.
 */
export function sampleOffer(): OfferInput {
  return {
    supplierName: 'Northside Food Supply',
    reference: 'Q-4417',
    currency: 'USD',
    quotedAt: new Date().toISOString(),
    lines: [
      {
        description: 'Mozzarella 2.5kg block',
        sku: 'MOZ-25',
        quantity: 120,
        packSize: 2.5,
        uom: 'kg',
        quotedUnitPrice: 18.4,
        discountPct: 6,
        tiers: [{ minQty: 150, discountPct: 9 }],
        sellUnitPrice: 11.5,
        confidence: 1,
      },
      {
        description: 'Extra virgin olive oil 5L tin',
        sku: 'OIL-5L',
        quantity: 40,
        packSize: 5,
        uom: 'L',
        quotedUnitPrice: 41.9,
        discountPct: 0,
        tiers: [],
        sellUnitPrice: 12.4,
        confidence: 1,
      },
      {
        description: 'Tomato passata 12 x 690g',
        sku: 'PAS-690',
        quantity: 60,
        packSize: 12,
        uom: 'unit',
        quotedUnitPrice: 14.25,
        discountPct: 5,
        tiers: [],
        sellUnitPrice: 1.85,
        confidence: 1,
      },
    ],
    paymentTerms: { netDays: 21, discountPct: 2, discountDays: 10, raw: '2/10 net 21' },
    freight: { flatPerOrder: 145, perUnit: 0, freeAboveOrderValue: 5000, allocation: 'value' },
    fees: [{ label: 'Fuel surcharge', amount: 4, basis: 'percent_of_goods' }],
    rebate: { pct: 3, thresholdQty: 500, thresholdValue: null, lagDays: 90, scope: 'order' },
    notes: 'Quotation valid 14 days.',
  };
}

/** What the same buyer paid three months ago, so the sample has a benchmark. */
export function sampleHistory(): HistoryPoint[] {
  const threeMonthsAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  return [
    {
      offerId: 'sample-1',
      productKey: 'sku:moz25',
      description: 'Mozzarella 2.5kg block',
      sku: 'MOZ-25',
      supplierId: null,
      supplierName: 'Northside Food Supply',
      trueNetUnitCost: 6.62,
      listUnitCost: 6.96,
      packSize: 2.5,
      occurredAt: threeMonthsAgo,
      netDays: 30,
    },
    {
      offerId: 'sample-2',
      productKey: 'sku:oil5l',
      description: 'Extra virgin olive oil 5L tin',
      sku: 'OIL-5L',
      supplierId: null,
      supplierName: 'Northside Food Supply',
      trueNetUnitCost: 8.05,
      listUnitCost: 8.18,
      packSize: 5,
      occurredAt: threeMonthsAgo,
      netDays: 30,
    },
    {
      offerId: 'sample-3',
      productKey: 'sku:pas690',
      description: 'Tomato passata 12 x 690g',
      sku: 'PAS-690',
      supplierId: null,
      supplierName: 'Harbour Wholesale',
      trueNetUnitCost: 1.09,
      listUnitCost: 1.16,
      packSize: 12,
      occurredAt: threeMonthsAgo,
      netDays: 30,
    },
  ];
}
