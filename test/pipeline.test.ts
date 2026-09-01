import { describe, expect, it } from 'vitest';
import { parseOfferFile, parseOfferText } from '@/lib/parsing';
import { analyzeOffer } from '@/lib/analysis/engine';
import { generateCounterOffer } from '@/lib/analysis/counter-offer';
import { productKey } from '@/lib/analysis/product-key';
import type { HistoryPoint } from '@/lib/types';
import { PASTED_QUOTE, quotationPdf } from './fixtures';

/** What a buyer's second offer from the same supplier has to work against. */
function historyFrom(text: string): HistoryPoint[] {
  const parsed = parseOfferText(text);
  const analysis = analyzeOffer(parsed.offer!, [], { costOfCapitalPct: 12 });
  return analysis.lines.map((line) => ({
    offerId: 'previous',
    productKey: line.productKey,
    description: line.description,
    sku: line.sku,
    supplierId: 'supplier-1',
    supplierName: analysis.supplierName,
    trueNetUnitCost: line.trueNetUnitCost,
    listUnitCost: line.listUnitCost,
    packSize: line.packSize,
    occurredAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    netDays: analysis.paymentTerms.netDays,
  }));
}

describe('upload → analyse → counter-offer', () => {
  it('turns a PDF quotation into a verdict and a sendable email', async () => {
    const parsed = await parseOfferFile(quotationPdf(), 'Q-4417.pdf', 'application/pdf');
    expect(parsed.ok).toBe(true);

    const analysis = analyzeOffer(parsed.offer!, [], { costOfCapitalPct: 12 });

    // Freight, the fuel surcharge and the rebate all had to be found in prose.
    expect(analysis.totals.freightTotal).toBe(145);
    expect(analysis.totals.feesTotal).toBeCloseTo(analysis.totals.invoiceSubtotal * 0.04, 1);
    expect(analysis.totals.earlyPaymentSaving).toBeGreaterThan(0);
    expect(analysis.totals.netTotal).toBeGreaterThan(0);
    // The whole point of the product: freight and the fuel surcharge outweigh
    // the discounts, so the offer settles above its own discounted line prices.
    const discountedLines = analysis.totals.grossTotal - analysis.totals.discountTotal;
    expect(analysis.totals.netTotal).toBeGreaterThan(discountedLines);
    expect(analysis.totals.headlineVsNet).toBeGreaterThan(0);

    // 3% rebate over 500 units, on 220 units ordered: it does not apply.
    expect(analysis.totals.rebateTotal).toBe(0);
    expect(analysis.flags.some((f) => f.code === 'unqualified_rebate')).toBe(true);

    const email = generateCounterOffer({
      analysis,
      buyerName: 'Sam Okafor',
      buyerCompany: 'Corner Street Deli',
    });

    expect(email.subject).toContain('Q-4417');
    expect(email.body).toContain('Sam Okafor');
    expect(email.body).toContain('Corner Street Deli');
    expect(email.body).toContain('rebate');
    expect(email.body.length).toBeGreaterThan(400);
  });

  it('flags the second offer as worse once there is history to compare with', () => {
    const history = historyFrom(PASTED_QUOTE);
    expect(history.length).toBe(3);

    // The same quote with every price raised 8%.
    const dearer = PASTED_QUOTE.replace('18.40', '19.87')
      .replace('41.90', '45.25')
      .replace('14.25', '15.39');

    const parsed = parseOfferText(dearer);
    const analysis = analyzeOffer(parsed.offer!, history, { costOfCapitalPct: 12 });

    expect(analysis.verdict).toBe('bad');
    const worse = analysis.flags.filter((f) => f.code === 'worse_than_last');
    expect(worse.length).toBeGreaterThanOrEqual(2);
    expect(analysis.savingsIdentified).toBeGreaterThan(0);

    const email = generateCounterOffer({
      analysis,
      buyerName: 'Sam Okafor',
      buyerCompany: 'Corner Street Deli',
      tone: 'firm',
    });
    expect(email.body).toContain('Target prices');
    expect(email.body).toContain('Mozzarella');
    expect(email.value).toBeGreaterThan(0);
  });

  it('calls the same offer good when prices have come down', () => {
    const history = historyFrom(PASTED_QUOTE);
    const cheaper = PASTED_QUOTE.replace('18.40', '16.20')
      .replace('41.90', '37.10')
      .replace('14.25', '12.60');

    const analysis = analyzeOffer(parseOfferText(cheaper).offer!, history, { costOfCapitalPct: 12 });

    expect(analysis.verdict).toBe('good');
    expect(analysis.flags.some((f) => f.code === 'better_than_last')).toBe(true);
  });

  it('matches products between a PDF and a pasted quote from the same supplier', async () => {
    const fromPdf = await parseOfferFile(quotationPdf(), 'Q-4417.pdf', 'application/pdf');
    const fromText = parseOfferText(PASTED_QUOTE);

    const pdfKeys = fromPdf.offer!.lines.map((l) => productKey(l.description, l.sku));
    const textKeys = fromText.offer!.lines.map((l) => productKey(l.description, l.sku));

    expect(pdfKeys.sort()).toEqual(textKeys.sort());
  });

  it('produces a usable analysis from hand-entered lines alone', () => {
    const analysis = analyzeOffer(
      {
        supplierName: 'Harbour Wholesale',
        reference: null,
        currency: 'USD',
        quotedAt: new Date().toISOString(),
        lines: [
          {
            description: 'Chicken breast 5kg tray',
            quantity: 30,
            packSize: 5,
            uom: 'kg',
            quotedUnitPrice: 62.5,
            discountPct: 0,
            tiers: [],
            sellUnitPrice: 18,
          },
        ],
        paymentTerms: { netDays: 14, discountPct: 0, discountDays: 0 },
        freight: { flatPerOrder: 60, perUnit: 0, freeAboveOrderValue: null, allocation: 'value' },
        fees: [],
      },
      [],
      { costOfCapitalPct: 12 },
    );

    const line = analysis.lines[0];
    expect(line.unitsTotal).toBe(150);
    expect(line.trueNetUnitCost).toBeGreaterThan(12);
    expect(line.trueMarginPct).not.toBeNull();
    expect(analysis.headline).toBeTruthy();
    expect(analysis.summary.length).toBeGreaterThan(50);
  });
});
