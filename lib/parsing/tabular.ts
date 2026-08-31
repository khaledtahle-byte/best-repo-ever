import type { OfferLineInput, ParseWarning, QuantityTier } from '@/lib/types';
import { parseNumber, parsePercent } from '@/lib/parsing/numbers';
import { packHintFromDescription } from '@/lib/parsing/pack-size';

export type ColumnKey =
  | 'description'
  | 'sku'
  | 'quantity'
  | 'packSize'
  | 'uom'
  | 'price'
  | 'discount'
  | 'rebate'
  | 'sell'
  | 'total'
  | 'tiers';

/** Header synonyms seen across distributor price lists and quote exports. */
const SYNONYMS: Record<ColumnKey, string[]> = {
  description: [
    'description', 'product', 'productname', 'item', 'itemdescription', 'itemname',
    'article', 'articledescription', 'goods', 'name', 'productdescription', 'line',
  ],
  sku: [
    'sku', 'code', 'itemcode', 'productcode', 'articleno', 'articlenumber', 'itemno',
    'itemnumber', 'partno', 'partnumber', 'ref', 'reference', 'stockcode', 'ean', 'upc',
  ],
  quantity: [
    'qty', 'quantity', 'orderqty', 'orderquantity', 'units', 'cases', 'volume',
    'qtyordered', 'quantityordered', 'packs', 'cartons', 'noofcases', 'count',
  ],
  packSize: [
    'packsize', 'pack', 'unitspercase', 'unitsperpack', 'casesize', 'innerpack',
    'perpack', 'percase', 'packqty', 'packquantity', 'size',
  ],
  uom: ['uom', 'unit', 'unitofmeasure', 'measure', 'units of measure', 'baseunit'],
  price: [
    'unitprice', 'price', 'listprice', 'unitcost', 'cost', 'rate', 'priceperunit',
    'pricecase', 'casePrice', 'caseprice', 'netprice', 'priceeach', 'each', 'unitrate',
    'sellingprice', 'costprice', 'buyprice', 'priceunit',
  ],
  discount: ['discount', 'disc', 'discountpct', 'discountpercent', 'disc%', 'discount%', 'offinvoice'],
  rebate: ['rebate', 'rebatepct', 'rebate%', 'volumerebate', 'backendrebate'],
  sell: ['sellprice', 'retail', 'retailprice', 'rrp', 'sell', 'menuprice', 'shelfprice', 'saleprice'],
  total: ['total', 'linetotal', 'amount', 'extended', 'extprice', 'extendedprice', 'value', 'nettotal'],
  tiers: ['tiers', 'breaks', 'volumebreaks', 'pricebreaks', 'tierpricing'],
};

export function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%]/g, '');
}

export interface ColumnMap {
  columns: Partial<Record<ColumnKey, number>>;
  /** Header columns like "100+" that hold a price at that volume. */
  tierColumns: Array<{ index: number; minQty: number }>;
  matched: number;
}

export function mapHeaderRow(row: string[]): ColumnMap {
  const columns: Partial<Record<ColumnKey, number>> = {};
  const tierColumns: Array<{ index: number; minQty: number }> = [];
  let matched = 0;

  row.forEach((cell, index) => {
    const header = normalizeHeader(String(cell ?? ''));
    if (!header) return;

    // "100+" / "250+" columns are volume-break prices.
    const tier = String(cell ?? '').trim().match(/^(\d[\d,]*)\s*\+$/);
    if (tier) {
      const minQty = parseNumber(tier[1]);
      if (minQty) {
        tierColumns.push({ index, minQty });
        matched += 1;
      }
      return;
    }

    for (const [key, list] of Object.entries(SYNONYMS) as Array<[ColumnKey, string[]]>) {
      if (columns[key] !== undefined) continue;
      if (list.includes(header) || list.some((s) => header === s)) {
        columns[key] = index;
        matched += 1;
        return;
      }
    }
    // Looser pass: "unit price (usd)" contains "unitprice".
    for (const [key, list] of Object.entries(SYNONYMS) as Array<[ColumnKey, string[]]>) {
      if (columns[key] !== undefined) continue;
      if (list.some((s) => s.length >= 4 && header.includes(s))) {
        columns[key] = index;
        matched += 1;
        return;
      }
    }
  });

  return { columns, tierColumns, matched };
}

/** Finds the header row in a grid that may start with title/address rows. */
export function findHeaderRow(grid: string[][]): { index: number; map: ColumnMap } | null {
  let best: { index: number; map: ColumnMap } | null = null;
  const limit = Math.min(grid.length, 30);

  for (let i = 0; i < limit; i += 1) {
    const map = mapHeaderRow(grid[i] ?? []);
    const hasIdentity = map.columns.description !== undefined || map.columns.sku !== undefined;
    const hasPrice = map.columns.price !== undefined || map.tierColumns.length > 0;
    if (hasIdentity && hasPrice && map.matched >= 2) {
      if (!best || map.matched > best.map.matched) best = { index: i, map };
    }
  }
  return best;
}

const NOISE_ROW = /^(sub\s*total|total|vat|tax|freight|delivery|shipping|carriage|terms|notes?|thank)/i;

export interface TabularParse {
  lines: OfferLineInput[];
  warnings: ParseWarning[];
  /** Flattened cell text, used to mine payment terms, freight and rebates. */
  text?: string;
}

export function gridToLines(grid: string[][]): TabularParse {
  const warnings: ParseWarning[] = [];
  const header = findHeaderRow(grid);

  if (!header) {
    return {
      lines: [],
      warnings: [
        {
          code: 'missing_columns',
          message: 'No product table was found in this file.',
          detail:
            'DealGuard looks for a header row containing a product or item column and a price column. Check the sheet, or enter the lines by hand.',
        },
      ],
    };
  }

  const { columns, tierColumns } = header.map;
  const lines: OfferLineInput[] = [];

  for (let i = header.index + 1; i < grid.length; i += 1) {
    const row = grid[i] ?? [];
    if (row.every((cell) => String(cell ?? '').trim() === '')) continue;

    const cell = (key: ColumnKey): string => {
      const index = columns[key];
      return index === undefined ? '' : String(row[index] ?? '').trim();
    };

    const description = cell('description') || cell('sku');
    if (!description) continue;
    if (NOISE_ROW.test(description)) continue;

    const price = parseNumber(cell('price'));
    const quantity = parseNumber(cell('quantity'));

    // A row with no price is a section heading, not a line item.
    if (price === null || price <= 0) {
      if (quantity !== null) {
        warnings.push({
          code: 'ambiguous_row',
          message: `Skipped "${description.slice(0, 48)}" — no unit price found.`,
        });
      }
      continue;
    }

    const explicitPack = parseNumber(cell('packSize'));
    const hint = packHintFromDescription(description);
    const packSize = explicitPack && explicitPack > 0 ? explicitPack : hint.packSize;
    const uom = cell('uom') || (explicitPack && explicitPack > 0 ? 'unit' : hint.uom);

    const tiers: QuantityTier[] = tierColumns
      .map(({ index, minQty }): QuantityTier | null => {
        const tierPrice = parseNumber(String(row[index] ?? ''));
        if (tierPrice === null || tierPrice <= 0) return null;
        return { minQty, discountPct: 0, unitPrice: tierPrice };
      })
      .filter((t): t is QuantityTier => t !== null);

    const tiersText = cell('tiers');
    if (tiersText) tiers.push(...parseTierText(tiersText));

    const rebatePct = parsePercent(cell('rebate'));
    const sell = parseNumber(cell('sell'));

    // Cross-check the line total when the sheet provides one.
    const stated = parseNumber(cell('total'));
    const qty = quantity && quantity > 0 ? quantity : 1;
    const discountPct = parsePercent(cell('discount')) ?? 0;
    const expected = qty * price * (1 - discountPct / 100);
    const totalAgrees = stated !== null && expected > 0 && Math.abs(stated - expected) / expected < 0.02;

    let confidence = 0.75;
    if (columns.quantity !== undefined && quantity !== null) confidence += 0.1;
    if (totalAgrees) confidence += 0.15;
    else if (stated !== null) confidence -= 0.25;
    if (quantity === null) confidence -= 0.2;

    lines.push({
      raw: row.join(' | '),
      description,
      sku: cell('sku') || null,
      quantity: qty,
      packSize,
      uom,
      quotedUnitPrice: price,
      discountPct,
      tiers,
      rebate:
        rebatePct && rebatePct > 0
          ? { pct: rebatePct, lagDays: 90, scope: 'line', thresholdQty: null, thresholdValue: null }
          : null,
      sellUnitPrice: sell && sell > 0 ? sell : null,
      confidence: Math.max(0.2, Math.min(1, confidence)),
    });

    if (stated !== null && !totalAgrees) {
      warnings.push({
        code: 'ambiguous_row',
        message: `"${description.slice(0, 48)}" — the stated line total does not match quantity × price.`,
        detail: `Sheet says ${stated}, quantity × price × discount is ${expected.toFixed(2)}. Check the pack size or discount.`,
      });
    }
  }

  if (lines.length === 0) {
    warnings.push({
      code: 'no_lines',
      message: 'A table header was found but none of the rows contained a usable price.',
    });
  }

  return { lines, warnings };
}

/** "100:5%; 250:8%" or "100+ @ 17.50" style tier text. */
export function parseTierText(value: string): QuantityTier[] {
  const tiers: QuantityTier[] = [];
  for (const part of value.split(/[;,\n]/)) {
    const pct = part.match(/(\d[\d,.]*)\s*(?:\+)?\s*[:@=]?\s*(\d[\d.,]*)\s*%/);
    if (pct) {
      const minQty = parseNumber(pct[1]);
      const discountPct = parseNumber(pct[2]);
      if (minQty && discountPct) tiers.push({ minQty, discountPct });
      continue;
    }
    const price = part.match(/(\d[\d,.]*)\s*\+?\s*[:@=]\s*[\$€£]?\s*(\d[\d.,]*)/);
    if (price) {
      const minQty = parseNumber(price[1]);
      const unitPrice = parseNumber(price[2]);
      if (minQty && unitPrice) tiers.push({ minQty, discountPct: 0, unitPrice });
    }
  }
  return tiers;
}
