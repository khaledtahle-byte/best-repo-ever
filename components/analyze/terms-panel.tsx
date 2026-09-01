import { CalendarClock, PackageCheck, Percent, Truck } from 'lucide-react';
import type { OfferAnalysis } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent, formatTerms } from '@/lib/format';

export function TermsPanel({ analysis }: { analysis: OfferAnalysis }) {
  const { paymentTerms, freight, fees, currency, paymentRecommendation } = analysis;

  const items = [
    {
      icon: CalendarClock,
      label: 'Payment terms',
      value: formatTerms(paymentTerms.discountPct, paymentTerms.discountDays, paymentTerms.netDays),
      detail: paymentRecommendation.detail,
    },
    {
      icon: Truck,
      label: 'Freight',
      value:
        freight.flatPerOrder > 0 || freight.perUnit > 0
          ? [
              freight.flatPerOrder > 0 ? `${formatCurrency(freight.flatPerOrder, currency)} per order` : null,
              freight.perUnit > 0 ? `${formatCurrency(freight.perUnit, currency)} per unit` : null,
            ]
              .filter(Boolean)
              .join(' + ')
          : 'Included',
      detail:
        freight.freeAboveOrderValue !== null
          ? `Waived above ${formatCurrency(freight.freeAboveOrderValue, currency)}. Allocated across lines by ${freight.allocation === 'value' ? 'line value' : 'quantity'}.`
          : `Allocated across lines by ${freight.allocation === 'value' ? 'line value' : 'quantity'}.`,
    },
    {
      icon: Percent,
      label: 'Surcharges',
      value: fees.length === 0 ? 'None' : `${fees.length} applied`,
      detail:
        fees.length === 0
          ? 'No fuel, pallet or handling charges were found in this offer.'
          : fees
              .map(
                (fee) =>
                  `${fee.label}: ${
                    fee.basis === 'percent_of_goods'
                      ? formatPercent(fee.amount)
                      : `${formatCurrency(fee.amount, currency)} ${fee.basis === 'unit' ? 'per unit' : 'per order'}`
                  }`,
              )
              .join(' · '),
    },
    {
      icon: PackageCheck,
      label: 'Rebate',
      value:
        analysis.totals.rebateTotal > 0
          ? formatCurrency(analysis.totals.rebateTotal, currency)
          : 'Not counted',
      detail:
        analysis.totals.rebateTotal > 0
          ? 'Discounted to present value for the delay before it is paid.'
          : 'Either no rebate was offered, or this order does not reach its threshold.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commercial terms</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <item.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-0.5 font-medium">{item.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
