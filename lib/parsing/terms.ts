import type { Fee, FreightTerms, PaymentTerms, RebateTerm } from '@/lib/types';
import { parseNumber, parsePercent } from '@/lib/parsing/numbers';

export const DEFAULT_PAYMENT_TERMS: PaymentTerms = {
  netDays: 30,
  discountPct: 0,
  discountDays: 0,
  raw: null,
};

export const DEFAULT_FREIGHT: FreightTerms = {
  flatPerOrder: 0,
  perUnit: 0,
  freeAboveOrderValue: null,
  allocation: 'value',
};

/**
 * Payment terms as suppliers actually write them: "2/10 net 30", "2% 10 days
 * net 30", "Net 45", "30 days EOM", "payable on delivery".
 */
export function extractPaymentTerms(text: string): PaymentTerms {
  const haystack = text.replace(/\s+/g, ' ');

  const slash = haystack.match(/(\d{1,2}(?:\.\d)?)\s*(?:%\s*)?\/\s*(\d{1,3})\s*(?:,)?\s*net\s*(\d{1,3})/i);
  if (slash) {
    return {
      discountPct: parseNumber(slash[1]) ?? 0,
      discountDays: parseNumber(slash[2]) ?? 0,
      netDays: parseNumber(slash[3]) ?? 30,
      raw: slash[0].trim(),
    };
  }

  const verbose = haystack.match(
    /(\d{1,2}(?:\.\d)?)\s*%\s*(?:discount\s*)?(?:if\s*paid\s*)?(?:with)?in\s*(\d{1,3})\s*days?[^.]{0,24}?net\s*(\d{1,3})/i,
  );
  if (verbose) {
    return {
      discountPct: parseNumber(verbose[1]) ?? 0,
      discountDays: parseNumber(verbose[2]) ?? 0,
      netDays: parseNumber(verbose[3]) ?? 30,
      raw: verbose[0].trim(),
    };
  }

  const net = haystack.match(/net\s*(\d{1,3})\b/i) ?? haystack.match(/\b(\d{1,3})\s*days?\s*(?:net|from invoice|eom)/i);
  if (net) {
    return { ...DEFAULT_PAYMENT_TERMS, netDays: parseNumber(net[1]) ?? 30, raw: net[0].trim() };
  }

  if (/\b(cash\s*on\s*delivery|c\.?o\.?d\.?|payment\s*on\s*delivery|prepaid)\b/i.test(haystack)) {
    return { netDays: 0, discountPct: 0, discountDays: 0, raw: 'On delivery' };
  }

  return { ...DEFAULT_PAYMENT_TERMS };
}

/** Delivery charges and the value at which they disappear. */
export function extractFreight(text: string): FreightTerms {
  const haystack = text.replace(/\s+/g, ' ');
  const freight: FreightTerms = { ...DEFAULT_FREIGHT };

  const free = haystack.match(
    /(?:free|no)\s*(?:delivery|freight|carriage|shipping)\s*(?:on\s*orders?\s*)?(?:over|above|from|>=?)\s*[\$€£]?\s*([\d.,]+)/i,
  ) ?? haystack.match(
    /(?:delivery|freight|carriage|shipping)\s*(?:is\s*)?free\s*(?:over|above|from)\s*[\$€£]?\s*([\d.,]+)/i,
  );
  if (free) freight.freeAboveOrderValue = parseNumber(free[1]);

  const perUnit = haystack.match(
    /(?:delivery|freight|carriage|shipping)[^.\n]{0,24}?[\$€£]?\s*([\d.,]+)\s*(?:per|\/)\s*(?:case|pallet|unit|carton|box)/i,
  );
  if (perUnit) freight.perUnit = parseNumber(perUnit[1]) ?? 0;

  const flat = haystack.match(
    /(?:delivery|freight|carriage|shipping|drop)\s*(?:charge|fee|cost)?\s*(?:of|:|=)?\s*[\$€£]\s*([\d.,]+)/i,
  ) ?? haystack.match(
    /(?:delivery|freight|carriage|shipping|drop)\s*(?:charge|fee|cost)\s*(?:of|:|=)?\s*([\d.,]+)/i,
  );
  if (flat && !perUnit) freight.flatPerOrder = parseNumber(flat[1]) ?? 0;

  const perDrop = haystack.match(/[\$€£]\s*([\d.,]+)\s*per\s*(?:drop|delivery|order)/i);
  if (perDrop) freight.flatPerOrder = parseNumber(perDrop[1]) ?? freight.flatPerOrder;

  return freight;
}

const FEE_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'Fuel surcharge', re: /fuel\s*(?:surcharge|levy)/i },
  { label: 'Pallet fee', re: /pallet\s*(?:fee|charge|deposit)/i },
  { label: 'Drop fee', re: /drop\s*(?:fee|charge)/i },
  { label: 'Small order fee', re: /(?:small|minimum)\s*order\s*(?:fee|charge|surcharge)/i },
  { label: 'Packaging charge', re: /(?:packaging|packing|crate)\s*(?:fee|charge)/i },
  { label: 'Admin fee', re: /(?:admin|administration|processing)\s*(?:fee|charge)/i },
  { label: 'Cold chain surcharge', re: /(?:cold\s*chain|refrigeration|chilled)\s*surcharge/i },
];

/** Surcharges that never make it into a headline unit price. */
export function extractFees(text: string): Fee[] {
  const fees: Fee[] = [];
  const lines = text.split(/[\n;]/);

  for (const line of lines) {
    for (const { label, re } of FEE_PATTERNS) {
      if (!re.test(line)) continue;
      const pct = line.match(/([\d.,]+)\s*%/);
      const money = line.match(/[\$€£]\s*([\d.,]+)/) ?? line.match(/(?:of|:|=)\s*([\d.,]+)\b/);
      if (pct) {
        const amount = parsePercent(pct[0]);
        if (amount && amount > 0) fees.push({ label, amount, basis: 'percent_of_goods' });
      } else if (money) {
        const amount = parseNumber(money[1]);
        if (amount && amount > 0) {
          const perUnit = /per\s*(?:case|unit|pallet|carton|box|drop)/i.test(line);
          fees.push({ label, amount, basis: perUnit ? 'unit' : 'order' });
        }
      }
      break;
    }
  }

  // Same surcharge mentioned twice in a document should only be charged once.
  const seen = new Set<string>();
  return fees.filter((fee) => {
    const key = `${fee.label}:${fee.basis}:${fee.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Back-end rebates, including the threshold that decides whether they are real. */
export function extractRebate(text: string): RebateTerm | null {
  const haystack = text.replace(/\s+/g, ' ');
  const match =
    haystack.match(
      /([\d.,]+)\s*%\s*(?:volume\s*|annual\s*|growth\s*|retro(?:spective)?\s*)?rebate[^.\n]{0,80}/i,
    ) ??
    haystack.match(
      /(?:volume\s*|annual\s*|growth\s*|retro(?:spective)?\s*)?rebate\s*(?:of\s*)?([\d.,]+)\s*%[^.\n]{0,80}/i,
    );
  if (!match) return null;

  const pct = parseNumber(match[1]);
  if (!pct || pct <= 0) return null;

  const context = match[0];
  const qty = context.match(/(?:over|above|from|beyond|exceeding|min(?:imum)?(?:\s*of)?)\s*([\d.,]+)\s*(?:units?|cases?|cartons?|pcs?)/i);
  const value = context.match(/(?:over|above|from|beyond|exceeding)\s*[\$€£]\s*([\d.,]+)/i);

  let lagDays = 90;
  if (/monthly/i.test(context)) lagDays = 30;
  else if (/quarterly/i.test(context)) lagDays = 90;
  else if (/annual|yearly|year[- ]end/i.test(context)) lagDays = 180;

  return {
    pct,
    thresholdQty: qty ? parseNumber(qty[1]) : null,
    thresholdValue: value ? parseNumber(value[1]) : null,
    lagDays,
    scope: 'order',
    label: context.trim().slice(0, 120),
  };
}

/** The supplier's own name, taken from the top of the document. */
export function extractSupplierName(text: string): string | null {
  const explicit = text.match(/(?:supplier|vendor|from|company|sold\s*by)\s*[:\-]\s*([^\n]{2,60})/i);
  if (explicit) return cleanName(explicit[1]);

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 70);

  for (const line of lines.slice(0, 6)) {
    if (/\d{3,}/.test(line)) continue;
    if (/^(quotation|quote|offer|price\s*list|invoice|proforma|date|ref)/i.test(line)) continue;
    if (/[a-z]/i.test(line)) return cleanName(line);
  }
  return null;
}

export function extractReference(text: string): string | null {
  const match = text.match(/(?:quote|quotation|offer|ref(?:erence)?|proposal|rfq)\s*(?:no\.?|number|#|:)?\s*([A-Z0-9][A-Z0-9\-\/]{2,20})/i);
  return match ? match[1].trim() : null;
}

function cleanName(value: string): string {
  return value
    .replace(/\s*[-–—|]\s*(quotation|quote|price\s*list|offer).*$/i, '')
    .replace(/[,:;]\s*$/, '')
    .trim()
    .slice(0, 80);
}
