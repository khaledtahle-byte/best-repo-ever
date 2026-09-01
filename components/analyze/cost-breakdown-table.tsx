import type { OfferAnalysis } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber, formatPercent, formatSignedPercent, formatUnitPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Order-level walk from the headline price to what the order really costs. */
export function CostWaterfall({ analysis }: { analysis: OfferAnalysis }) {
  const { totals, currency } = analysis;

  const steps = [
    { label: 'Gross at list price', value: totals.grossTotal, kind: 'base' as const },
    { label: 'Volume and invoice discounts', value: -totals.discountTotal, kind: 'down' as const },
    { label: 'Invoice subtotal', value: totals.invoiceSubtotal, kind: 'subtotal' as const },
    { label: 'Freight', value: totals.freightTotal, kind: 'up' as const },
    { label: 'Surcharges and fees', value: totals.feesTotal, kind: 'up' as const },
    { label: 'Invoice total', value: totals.invoiceTotal, kind: 'subtotal' as const },
    { label: 'Early-payment discount', value: -totals.earlyPaymentSaving, kind: 'down' as const },
    { label: 'Value of payment terms', value: -totals.financingBenefit, kind: 'down' as const },
    { label: 'Rebate, at present value', value: -totals.rebateTotal, kind: 'down' as const },
    { label: 'True net cost', value: totals.netTotal, kind: 'total' as const },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>What this order actually costs</CardTitle>
        <CardDescription>
          Every component between the quoted price and the cash you part with.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <dl className="divide-y divide-border/70">
          {steps.map((step) => (
            <div
              key={step.label}
              className={cn(
                'flex items-center justify-between gap-4 px-6 py-3',
                (step.kind === 'subtotal' || step.kind === 'total') && 'bg-secondary/30',
              )}
            >
              <dt
                className={cn(
                  'text-sm',
                  step.kind === 'total'
                    ? 'font-semibold text-foreground'
                    : step.kind === 'subtotal'
                      ? 'font-medium text-foreground/90'
                      : 'text-muted-foreground',
                )}
              >
                {step.label}
              </dt>
              <dd
                className={cn(
                  'tabular text-sm font-medium',
                  step.kind === 'up' && step.value > 0 && 'text-review',
                  step.kind === 'down' && step.value < 0 && 'text-good',
                  step.kind === 'total' && 'text-base font-semibold',
                )}
              >
                {step.value < 0 ? '−' : ''}
                {formatCurrency(Math.abs(step.value), currency)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/** Line-by-line: what was quoted, and what each unit really costs. */
export function CostBreakdownTable({ analysis }: { analysis: OfferAnalysis }) {
  const { currency } = analysis;
  const hasMargin = analysis.lines.some((line) => line.trueMarginPct !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost breakdown by line</CardTitle>
        <CardDescription>
          True net cost is per {analysis.lines[0]?.uom ?? 'unit'} — pack sizes are normalised so lines
          are comparable.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="hidden text-right sm:table-cell">List / unit</TableHead>
              <TableHead className="hidden text-right md:table-cell">Invoiced / unit</TableHead>
              <TableHead className="text-right">True net / unit</TableHead>
              <TableHead className="hidden text-right lg:table-cell">vs benchmark</TableHead>
              {hasMargin ? <TableHead className="hidden text-right lg:table-cell">Margin</TableHead> : null}
              <TableHead className="text-right">Line net</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {analysis.lines.map((line) => (
              <TableRow key={line.index} className="align-top">
                <TableCell className="max-w-[18rem]">
                  <p className="truncate font-medium">{line.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {line.sku ? `${line.sku} · ` : ''}
                    {line.packSize !== 1
                      ? `${formatNumber(line.packSize, 2)} ${line.uom} per unit · `
                      : ''}
                    {line.headlineDiscountPct > 0
                      ? `${formatPercent(line.headlineDiscountPct)} quoted, ${formatPercent(line.effectiveDiscountPct)} real`
                      : 'no discount'}
                  </p>
                </TableCell>

                <TableCell className="tabular whitespace-nowrap text-right">
                  {formatNumber(line.quantity, 2)}
                </TableCell>

                <TableCell className="tabular hidden whitespace-nowrap text-right text-muted-foreground sm:table-cell">
                  {formatUnitPrice(line.listUnitCost, currency)}
                </TableCell>

                <TableCell className="tabular hidden whitespace-nowrap text-right text-muted-foreground md:table-cell">
                  {formatUnitPrice(line.invoiceUnitCost, currency)}
                </TableCell>

                <TableCell className="tabular whitespace-nowrap text-right font-semibold">
                  {formatUnitPrice(line.trueNetUnitCost, currency)}
                </TableCell>

                <TableCell className="tabular hidden whitespace-nowrap text-right lg:table-cell">
                  {line.benchmark ? (
                    <span className={line.benchmark.deltaPct > 0 ? 'text-bad' : 'text-good'}>
                      {formatSignedPercent(line.benchmark.deltaPct)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {hasMargin ? (
                  <TableCell className="tabular hidden whitespace-nowrap text-right lg:table-cell">
                    {line.trueMarginPct === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          line.trueMarginPct < 0
                            ? 'text-bad'
                            : line.trueMarginPct < analysis.options.targetMarginPct
                              ? 'text-review'
                              : 'text-good',
                        )}
                      >
                        {formatPercent(line.trueMarginPct)}
                      </span>
                    )}
                  </TableCell>
                ) : null}

                <TableCell className="tabular whitespace-nowrap text-right">
                  {formatCurrency(line.netLineCost, currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>

          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell />
              <TableCell className="hidden sm:table-cell" />
              <TableCell className="hidden md:table-cell" />
              <TableCell />
              <TableCell className="hidden lg:table-cell" />
              {hasMargin ? (
                <TableCell className="tabular hidden text-right lg:table-cell">
                  {analysis.totals.marginTotal === null
                    ? '—'
                    : formatCurrency(analysis.totals.marginTotal, currency)}
                </TableCell>
              ) : null}
              <TableCell className="tabular text-right font-semibold">
                {formatCurrency(analysis.totals.netTotal, currency)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
