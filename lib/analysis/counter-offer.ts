import type { OfferAnalysis } from '@/lib/types';
import { formatCurrency, formatPercent, formatUnitPrice } from '@/lib/format';
import { round } from '@/lib/utils';

export type CounterOfferTone = 'collaborative' | 'firm';

export interface CounterOfferInput {
  analysis: OfferAnalysis;
  buyerName: string;
  buyerCompany: string;
  supplierContact?: string | null;
  tone?: CounterOfferTone;
  /** How long the supplier has to respond. */
  deadlineDays?: number;
}

export interface CounterOffer {
  subject: string;
  body: string;
  /** Total value of the asks, so the UI can show what the email is worth. */
  value: number;
}

/**
 * Turns an analysis into an email a buyer can actually send: named lines, named
 * numbers, and a specific ask per problem. No adjectives the supplier can argue
 * with — only prices the buyer can point at.
 */
export function generateCounterOffer(input: CounterOfferInput): CounterOffer {
  const { analysis, buyerName, buyerCompany } = input;
  const tone: CounterOfferTone = input.tone ?? 'collaborative';
  const deadlineDays = input.deadlineDays ?? 5;
  const currency = analysis.currency;
  const greetingName = input.supplierContact?.trim() || analysis.supplierName;

  const reference = analysis.reference ? ` ${analysis.reference}` : '';
  const subject =
    tone === 'firm'
      ? `Re: quotation${reference} — revised pricing needed before we order`
      : `Re: quotation${reference} — a few items to work through`;

  const lines: string[] = [];

  lines.push(`Hi ${greetingName},`);
  lines.push('');
  lines.push(
    tone === 'firm'
      ? `Thanks for the quote${reference}. We have run it against our cost history and it does not work as written. Below is what we need to place the order.`
      : `Thanks for sending quotation${reference}. We have costed it out against what we have been paying and there are a few points worth working through before we commit.`,
  );
  lines.push('');

  // The single most persuasive fact: the quote is not what it looks like.
  const quoted = analysis.totals.grossTotal - analysis.totals.discountTotal;
  if (Math.abs(analysis.totals.netTotal - quoted) >= 1) {
    const direction = analysis.totals.netTotal > quoted ? 'above' : 'below';
    lines.push(
      `On our numbers the order invoices at ${formatCurrency(analysis.totals.invoiceTotal, currency)} and lands at a true net cost of ${formatCurrency(
        analysis.totals.netTotal,
        currency,
      )} once freight, surcharges, rebate timing and payment terms are included — ${formatCurrency(
        Math.abs(analysis.totals.netTotal - quoted),
        currency,
      )} ${direction} the discounted line prices.`,
    );
    lines.push('');
  }

  if (analysis.asks.length > 0) {
    lines.push(tone === 'firm' ? 'What we need:' : 'What we would like to agree:');
    lines.push('');
    analysis.asks.forEach((ask, i) => {
      const worth = ask.value > 0 ? ` (worth ${formatCurrency(ask.value, currency)} on this order)` : '';
      lines.push(`${i + 1}. ${ask.ask}${worth}`);
      if (ask.rationale) lines.push(`   Why: ${ask.rationale}`);
    });
    lines.push('');
  }

  // A concrete target-price table beats a vague "can you sharpen this".
  const targetRows = analysis.lines
    .filter((line) => line.benchmark && line.benchmark.deltaPct > analysis.options.materialityPct)
    .slice(0, 8);

  if (targetRows.length > 0) {
    lines.push('Target prices (delivered, net of rebate):');
    lines.push('');
    const width = Math.min(
      44,
      Math.max(16, ...targetRows.map((r) => r.description.length)),
    );
    lines.push(
      `${'Item'.padEnd(width)}  ${'Quoted'.padStart(12)}  ${'Target'.padStart(12)}  ${'Gap'.padStart(9)}`,
    );
    lines.push('-'.repeat(width + 39));
    for (const row of targetRows) {
      const target = row.benchmark!.unitCost;
      const gap = (row.trueNetUnitCost - target) * row.unitsTotal;
      lines.push(
        `${trimTo(row.description, width).padEnd(width)}  ${formatUnitPrice(row.trueNetUnitCost, currency).padStart(12)}  ${formatUnitPrice(
          target,
          currency,
        ).padStart(12)}  ${formatCurrency(gap, currency).padStart(9)}`,
      );
    }
    lines.push('');
  }

  const rebateFlags = analysis.flags.filter((f) => f.code === 'unqualified_rebate');
  if (rebateFlags.length > 0) {
    lines.push(
      `To be clear on the rebate: we can only treat it as a discount if it applies at the volumes we actually order. As written it does not, so we have costed the offer without it.`,
    );
    lines.push('');
  }

  const hidden = analysis.flags.filter((f) => f.code === 'hidden_cost');
  if (hidden.length > 0) {
    const hiddenTotal = analysis.totals.freightTotal + analysis.totals.feesTotal;
    lines.push(
      `Please also quote delivered pricing going forward. ${formatCurrency(
        hiddenTotal,
        currency,
      )} of this order sits outside the unit prices, which makes it impossible to compare your offer against anyone else's.`,
    );
    lines.push('');
  }

  if (analysis.paymentRecommendation.action === 'take_discount') {
    lines.push(
      `We are happy to keep paying within ${analysis.paymentTerms.discountDays} days to take the ${formatPercent(
        analysis.paymentTerms.discountPct,
      )} settlement discount — we would like that kept in place.`,
    );
    lines.push('');
  } else if (analysis.paymentTerms.discountPct === 0 && analysis.paymentTerms.netDays <= 30) {
    lines.push(
      `If the price cannot move, a ${analysis.paymentTerms.netDays < 30 ? 'net 30' : '2% settlement discount for payment in 10 days'} would close some of the gap for us.`,
    );
    lines.push('');
  }

  if (analysis.savingsIdentified > 0) {
    lines.push(
      tone === 'firm'
        ? `In total we are ${formatCurrency(analysis.savingsIdentified, currency)} apart on this order. Please come back with a revised quotation within ${deadlineDays} working days; otherwise we will place it elsewhere for this cycle.`
        : `Altogether that is about ${formatCurrency(analysis.savingsIdentified, currency)} on this order. Could you come back with a revised quotation in the next ${deadlineDays} working days? We would rather keep the volume with you.`,
    );
  } else {
    lines.push(
      `Could you confirm these points in writing so we can get the order raised in the next ${deadlineDays} working days?`,
    );
  }

  lines.push('');
  lines.push('Best regards,');
  lines.push(buyerName || 'Purchasing');
  if (buyerCompany) lines.push(buyerCompany);

  return {
    subject,
    body: lines.join('\n'),
    value: round(analysis.asks.reduce((acc, a) => acc + Math.max(0, a.value), 0)),
  };
}

function trimTo(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`;
}
