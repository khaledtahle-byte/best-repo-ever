import Link from 'next/link';
import type { Metadata } from 'next';
import { Lock, TrendingDown, TrendingUp, Truck, Upload } from 'lucide-react';
import { requireSessionContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getPriceHistory, getSupplierSummaries } from '@/lib/queries';
import { PageHeader } from '@/components/app/page-header';
import { EmptyState } from '@/components/app/empty-state';
import { VerdictBadge } from '@/components/app/verdict-badge';
import { PriceHistoryChart } from '@/components/app/price-history-chart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatNumber, formatSignedPercent } from '@/lib/format';
import { median } from '@/lib/utils';

export const metadata: Metadata = { title: 'Suppliers' };

export default async function SuppliersPage() {
  const session = await requireSessionContext();
  const supabase = createClient();

  const suppliers = await getSupplierSummaries(supabase, session.user.id, session.orgId);
  const history = session.entitlements.canUseHistory
    ? await getPriceHistory(supabase, session.user.id, session.orgId, { limit: 800 })
    : [];

  const currency = suppliers[0]?.currency ?? session.profile.default_currency ?? 'USD';

  return (
    <div className="space-y-8">
      <PageHeader
        title="Suppliers"
        description="What each supplier has quoted you, and how the true cost per unit has moved over time."
        actions={
          <Button asChild>
            <Link href="/app/analyze">
              <Upload className="h-4 w-4" />
              Analyse an offer
            </Link>
          </Button>
        }
      />

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Suppliers appear here as soon as you analyse an offer from them. Two offers for the same product and you get a price trend."
          action={
            <Button asChild>
              <Link href="/app/analyze">Analyse your first offer</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Your suppliers</CardTitle>
              <CardDescription>{suppliers.length} tracked</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Offers</TableHead>
                    <TableHead className="hidden sm:table-cell">Last quote</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Analysed spend</TableHead>
                    <TableHead className="text-right">On the table</TableHead>
                    <TableHead>Worst verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>
                        <p className="font-medium">{supplier.name}</p>
                        {supplier.contact_email ? (
                          <p className="text-xs text-muted-foreground">{supplier.contact_email}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular text-right">{formatNumber(supplier.offerCount)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground sm:table-cell">
                        {formatDate(supplier.lastOfferAt)}
                      </TableCell>
                      <TableCell className="tabular hidden whitespace-nowrap text-right md:table-cell">
                        {formatCurrency(supplier.netTotal, supplier.currency)}
                      </TableCell>
                      <TableCell className="tabular whitespace-nowrap text-right text-primary">
                        {supplier.savingsIdentified > 0
                          ? formatCurrency(supplier.savingsIdentified, supplier.currency)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <VerdictBadge verdict={supplier.worstVerdict} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price history</CardTitle>
              <CardDescription>
                {session.entitlements.canUseHistory
                  ? 'True net cost per unit, by product and supplier.'
                  : 'Price history is part of Pro.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session.entitlements.canUseHistory ? (
                <PriceHistoryChart rows={history} currency={currency} />
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Lock className="h-5 w-5" />
                  </span>
                  <p className="mt-4 max-w-md text-sm text-muted-foreground">
                    Pro keeps a price trend for every product and supplier, and uses it to tell you
                    when an offer is worse than the last one.
                  </p>
                  <Button asChild className="mt-5">
                    <Link href="/app/settings">Upgrade to Pro</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {session.entitlements.canUseHistory && history.length > 0 ? (
            <ProductMovers history={history} currency={currency} />
          ) : null}
        </>
      )}
    </div>
  );
}

/** Products whose true cost has moved most since the first time they were quoted. */
function ProductMovers({
  history,
  currency,
}: {
  history: Awaited<ReturnType<typeof getPriceHistory>>;
  currency: string;
}) {
  const byProduct = new Map<string, typeof history>();
  for (const row of history) {
    const list = byProduct.get(row.product_key) ?? [];
    list.push(row);
    byProduct.set(row.product_key, list);
  }

  const movers = Array.from(byProduct.values())
    .filter((rows) => rows.length >= 2)
    .map((rows) => {
      const sorted = rows.slice().sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const firstCost = Number(first.true_net_unit_cost);
      const lastCost = Number(last.true_net_unit_cost);
      const best = median(sorted.map((r) => Number(r.true_net_unit_cost))) ?? lastCost;
      return {
        key: first.product_key,
        description: last.description,
        uom: last.uom,
        firstCost,
        lastCost,
        median: best,
        deltaPct: firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0,
        supplier: last.supplier_name,
        observations: sorted.length,
      };
    })
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 8);

  if (movers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biggest movers</CardTitle>
        <CardDescription>Change in true net cost since the first offer you analysed.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Product</TableHead>
              <TableHead className="hidden sm:table-cell">Latest supplier</TableHead>
              <TableHead className="text-right">First</TableHead>
              <TableHead className="text-right">Now</TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movers.map((mover) => (
              <TableRow key={mover.key}>
                <TableCell>
                  <p className="font-medium">{mover.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {mover.observations} offers · per {mover.uom}
                  </p>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {mover.supplier}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-right text-muted-foreground">
                  {formatCurrency(mover.firstCost, currency, { maximumFractionDigits: 3 })}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-right font-medium">
                  {formatCurrency(mover.lastCost, currency, { maximumFractionDigits: 3 })}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap text-right">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      mover.deltaPct > 0 ? 'text-bad' : 'text-good'
                    }`}
                  >
                    {mover.deltaPct > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {formatSignedPercent(mover.deltaPct)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
