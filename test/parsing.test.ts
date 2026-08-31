import { describe, expect, it } from 'vitest';
import { parseOfferFile, parseOfferText, detectSourceType, detectCurrency } from '@/lib/parsing';
import { parseNumber, parsePercent } from '@/lib/parsing/numbers';
import { packHintFromDescription } from '@/lib/parsing/pack-size';
import {
  extractFees,
  extractFreight,
  extractPaymentTerms,
  extractRebate,
  extractReference,
} from '@/lib/parsing/terms';
import { PASTED_QUOTE, QUOTE_CSV, quotationPdf, buildPdf } from './fixtures';

describe('parseNumber', () => {
  it('handles the ways suppliers write money', () => {
    expect(parseNumber('18.40')).toBe(18.4);
    expect(parseNumber('$1,234.56')).toBe(1234.56);
    expect(parseNumber('€1.234,56')).toBe(1234.56);
    expect(parseNumber('12,50')).toBe(12.5);
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('(125.00)')).toBe(-125);
    expect(parseNumber('18.40/case')).toBe(18.4);
    expect(parseNumber('  42 ')).toBe(42);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('n/a')).toBeNull();
  });

  it('reads percentages in every notation', () => {
    expect(parsePercent('6%')).toBe(6);
    expect(parsePercent('6')).toBe(6);
    expect(parsePercent('0.06')).toBeCloseTo(6);
    expect(parsePercent('')).toBeNull();
  });
});

describe('packHintFromDescription', () => {
  it('pulls the pack size out of the description', () => {
    expect(packHintFromDescription('Tomato passata 12 x 690g').packSize).toBe(12);
    expect(packHintFromDescription('Cola case of 24').packSize).toBe(24);
    expect(packHintFromDescription('Napkins 500ct').packSize).toBe(500);
    expect(packHintFromDescription('Mozzarella 2.5kg block')).toEqual({ packSize: 2.5, uom: 'kg' });
    expect(packHintFromDescription('Chef knife').packSize).toBe(1);
  });
});

describe('commercial terms extraction', () => {
  it('reads payment terms in the usual notations', () => {
    expect(extractPaymentTerms('Payment terms: 2/10 net 30')).toMatchObject({
      discountPct: 2, discountDays: 10, netDays: 30,
    });
    expect(extractPaymentTerms('2% within 10 days, otherwise net 45')).toMatchObject({
      discountPct: 2, discountDays: 10, netDays: 45,
    });
    expect(extractPaymentTerms('Terms: Net 60')).toMatchObject({ netDays: 60, discountPct: 0 });
    expect(extractPaymentTerms('Cash on delivery')).toMatchObject({ netDays: 0 });
    expect(extractPaymentTerms('no terms mentioned')).toMatchObject({ netDays: 30 });
  });

  it('reads freight charges and the free-freight threshold', () => {
    const freight = extractFreight('Delivery charge: $145 per drop. Free delivery over $5,000.');
    expect(freight.flatPerOrder).toBe(145);
    expect(freight.freeAboveOrderValue).toBe(5000);
    expect(extractFreight('Freight $12 per pallet').perUnit).toBe(12);
  });

  it('finds surcharges hiding in the small print', () => {
    const fees = extractFees('Fuel surcharge 4% applies.\nPallet fee $25 per pallet.');
    expect(fees).toHaveLength(2);
    expect(fees[0]).toMatchObject({ label: 'Fuel surcharge', amount: 4, basis: 'percent_of_goods' });
    expect(fees[1]).toMatchObject({ label: 'Pallet fee', amount: 25, basis: 'unit' });
  });

  it('reads a rebate with its threshold and settlement lag', () => {
    const rebate = extractRebate('Volume rebate of 3% over 500 units, paid quarterly.');
    expect(rebate).toMatchObject({ pct: 3, thresholdQty: 500, lagDays: 90 });
    expect(extractRebate('No rebate offered on this quote')).toBeNull();
  });

  it('finds the quote reference and currency', () => {
    expect(extractReference('Quotation Q-4417 dated 12 August')).toBe('Q-4417');
    expect(detectCurrency('Total £1,200')).toBe('GBP');
    expect(detectCurrency('Total 1200 EUR')).toBe('EUR');
  });
});

describe('detectSourceType', () => {
  it('maps filenames and mime types to a parser', () => {
    expect(detectSourceType('quote.pdf', 'application/pdf')).toBe('pdf');
    expect(detectSourceType('quote.CSV', '')).toBe('csv');
    expect(detectSourceType('quote.xlsx', '')).toBe('xlsx');
    expect(detectSourceType('quote.docx', 'application/msword')).toBeNull();
  });
});

describe('parseOfferText', () => {
  it('reads a pasted quotation into priced lines and terms', () => {
    const result = parseOfferText(PASTED_QUOTE);
    expect(result.ok).toBe(true);
    expect(result.offer).not.toBeNull();

    const offer = result.offer!;
    expect(offer.lines).toHaveLength(3);

    const [mozzarella, oil, passata] = offer.lines;
    expect(mozzarella.description).toContain('Mozzarella');
    expect(mozzarella.quantity).toBe(120);
    expect(mozzarella.quotedUnitPrice).toBe(18.4);
    expect(mozzarella.discountPct).toBe(6);
    expect(mozzarella.packSize).toBe(2.5);
    expect(mozzarella.uom).toBe('kg');

    expect(oil.quantity).toBe(40);
    expect(oil.quotedUnitPrice).toBe(41.9);
    expect(passata.packSize).toBe(12);

    expect(offer.paymentTerms).toMatchObject({ discountPct: 2, discountDays: 10, netDays: 30 });
    expect(offer.freight.flatPerOrder).toBe(145);
    expect(offer.freight.freeAboveOrderValue).toBe(5000);
    expect(offer.fees.some((f) => f.label === 'Fuel surcharge')).toBe(true);
    expect(offer.rebate).toMatchObject({ pct: 3, thresholdQty: 500 });
    expect(offer.supplierName).toContain('Northside');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('does not mistake totals and footers for products', () => {
    const result = parseOfferText(PASTED_QUOTE);
    const descriptions = result.offer!.lines.map((l) => l.description.toLowerCase());
    expect(descriptions.some((d) => d.includes('subtotal'))).toBe(false);
    expect(descriptions.some((d) => d.includes('delivery'))).toBe(false);
  });

  it('reads a pasted spreadsheet region using its headers', () => {
    const pasted = [
      'Description\tQty\tUnit Price\tDiscount %',
      'Mozzarella 2.5kg block\t120\t18.40\t6',
      'Olive oil 5L tin\t40\t41.90\t0',
    ].join('\n');
    const result = parseOfferText(pasted);
    expect(result.offer!.lines).toHaveLength(2);
    expect(result.offer!.lines[0].quotedUnitPrice).toBe(18.4);
  });

  it('reports a clean failure on unusable input', () => {
    const result = parseOfferText('hello there, no numbers here at all');
    expect(result.ok).toBe(false);
    expect(result.offer).toBeNull();
    expect(result.warnings[0].code).toBe('no_lines');
  });

  it('returns a warning rather than throwing on empty input', () => {
    expect(parseOfferText('   ').ok).toBe(false);
  });
});

describe('parseOfferFile — CSV', () => {
  it('maps header columns, including pack size and retail price', async () => {
    const buffer = new TextEncoder().encode(QUOTE_CSV).buffer as ArrayBuffer;
    const result = await parseOfferFile(buffer, 'quote.csv', 'text/csv');
    expect(result.ok).toBe(true);

    const offer = result.offer!;
    expect(offer.lines).toHaveLength(3);
    expect(offer.lines[0]).toMatchObject({
      sku: 'MOZ-25',
      quantity: 120,
      quotedUnitPrice: 18.4,
      discountPct: 6,
      sellUnitPrice: 29.99,
    });
    expect(offer.lines[2].packSize).toBe(12);
    expect(offer.paymentTerms.netDays).toBe(30);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('reads volume-break columns like "100+"', async () => {
    const csv = 'Item,Qty,Unit Price,50+,250+\nWidget,60,10.00,9.50,8.75\n';
    const buffer = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    const result = await parseOfferFile(buffer, 'breaks.csv', 'text/csv');
    const tiers = result.offer!.lines[0].tiers;
    expect(tiers).toEqual([
      { minQty: 50, discountPct: 0, unitPrice: 9.5 },
      { minQty: 250, discountPct: 0, unitPrice: 8.75 },
    ]);
  });

  it('explains itself when there is no recognisable table', async () => {
    const buffer = new TextEncoder().encode('a,b,c\n1,2,3\n').buffer as ArrayBuffer;
    const result = await parseOfferFile(buffer, 'junk.csv', 'text/csv');
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('parseOfferFile — XLSX', () => {
  it('reads a workbook written by ExcelJS', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Quote');
    sheet.addRow(['Northside Food Supply Co']);
    sheet.addRow([]);
    sheet.addRow(['Item Code', 'Description', 'Qty', 'Unit Price', 'Discount %']);
    sheet.addRow(['MOZ-25', 'Mozzarella 2.5kg block', 120, 18.4, 6]);
    sheet.addRow(['OIL-5L', 'Olive oil 5L tin', 40, 41.9, 0]);
    sheet.addRow([]);
    sheet.addRow(['Payment terms: 2/10 net 30']);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

    const result = await parseOfferFile(buffer, 'quote.xlsx', '');
    expect(result.ok).toBe(true);
    expect(result.offer!.lines).toHaveLength(2);
    expect(result.offer!.lines[0].quotedUnitPrice).toBe(18.4);
    expect(result.offer!.paymentTerms).toMatchObject({ discountPct: 2, netDays: 30 });
  });
});

describe('parseOfferFile — PDF', () => {
  it('reads line items and terms out of a real PDF text layer', async () => {
    const result = await parseOfferFile(quotationPdf(), 'quote.pdf', 'application/pdf');
    expect(result.ok).toBe(true);

    const offer = result.offer!;
    expect(offer.lines.length).toBe(3);
    expect(offer.lines[0].quantity).toBe(120);
    expect(offer.lines[0].quotedUnitPrice).toBe(18.4);
    expect(offer.lines[0].discountPct).toBe(6);
    expect(offer.paymentTerms).toMatchObject({ discountPct: 2, discountDays: 10, netDays: 30 });
    expect(offer.freight.flatPerOrder).toBe(145);
    expect(offer.rebate).toMatchObject({ pct: 3, thresholdQty: 500 });
    // Line totals in the PDF reconcile, so confidence should be high.
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('tells the user plainly when a PDF has no text layer', async () => {
    const blank = buildPdf([{ x: 50, y: 700, text: '.' }]);
    const result = await parseOfferFile(blank, 'scan.pdf', 'application/pdf');
    expect(result.ok).toBe(false);
    expect(result.warnings[0].code).toBe('unreadable_file');
    expect(result.warnings[0].message).toContain('no text layer');
  });

  it('does not throw on a corrupt file', async () => {
    const junk = new TextEncoder().encode('not a pdf at all').buffer as ArrayBuffer;
    const result = await parseOfferFile(junk, 'broken.pdf', 'application/pdf');
    expect(result.ok).toBe(false);
    expect(result.offer).toBeNull();
  });

  it('rejects unsupported file types with a useful message', async () => {
    const buffer = new TextEncoder().encode('x').buffer as ArrayBuffer;
    const result = await parseOfferFile(buffer, 'quote.docx', 'application/msword');
    expect(result.ok).toBe(false);
    expect(result.warnings[0].message).toContain('not a supported file type');
  });
});
