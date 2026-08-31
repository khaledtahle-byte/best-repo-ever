'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { PriceHistoryRow } from '@/lib/supabase/types';
import { formatDate, formatUnitPrice } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** One drawn series per supplier, so a product's suppliers can be compared. */
interface Series {
  supplierName: string;
  colorIndex: number;
  points: Array<{ t: number; value: number }>;
}

const SERIES_COLORS = [
  'hsl(188 100% 47%)',
  'hsl(38 94% 55%)',
  'hsl(158 74% 42%)',
  'hsl(266 70% 65%)',
  'hsl(356 79% 58%)',
];

export function PriceHistoryChart({
  rows,
  currency,
}: {
  rows: PriceHistoryRow[];
  currency: string;
}) {
  const products = useMemo(() => {
    const map = new Map<string, { key: string; label: string; uom: string; count: number }>();
    for (const row of rows) {
      const existing = map.get(row.product_key);
      if (existing) existing.count += 1;
      else map.set(row.product_key, { key: row.product_key, label: row.description, uom: row.uom, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rows]);

  const [selected, setSelected] = useState<string>(products[0]?.key ?? '');
  const active = products.find((p) => p.key === selected) ?? products[0];

  const { series, data } = useMemo(() => {
    const filtered = rows.filter((row) => row.product_key === active?.key);
    const bySupplier = new Map<string, Series>();

    filtered.forEach((row) => {
      const name = row.supplier_name;
      if (!bySupplier.has(name)) {
        bySupplier.set(name, { supplierName: name, colorIndex: bySupplier.size, points: [] });
      }
      bySupplier.get(name)!.points.push({
        t: Date.parse(row.occurred_at),
        value: Number(row.true_net_unit_cost),
      });
    });

    // Recharts wants one row per x value with a key per series.
    const timestamps = Array.from(new Set(filtered.map((row) => Date.parse(row.occurred_at)))).sort(
      (a, b) => a - b,
    );
    const list = Array.from(bySupplier.values());
    const rowsForChart = timestamps.map((t) => {
      const entry: Record<string, number | null> = { t };
      for (const s of list) {
        const match = s.points.find((p) => p.t === t);
        entry[s.supplierName] = match ? match.value : null;
      }
      return entry;
    });

    return { series: list, data: rowsForChart };
  }, [rows, active?.key]);

  if (products.length === 0 || !active) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No price history yet. Analyse a second offer for the same product to see the trend.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={active.key} onValueChange={setSelected}>
          <SelectTrigger className="sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.key} value={product.key}>
                {product.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.supplierName} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: SERIES_COLORS[s.colorIndex % SERIES_COLORS.length] }}
              />
              {s.supplierName}
            </span>
          ))}
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="hsl(214 36% 18%)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(value: number) => formatDate(new Date(value))}
              stroke="hsl(213 20% 66%)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
            />
            <YAxis
              stroke="hsl(213 20% 66%)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={64}
              tickFormatter={(value: number) => formatUnitPrice(value, currency)}
            />
            <Tooltip
              content={(props: TooltipProps<number, string>) => <ChartTooltip {...props} currency={currency} uom={active.uom} />}
            />
            {series.map((s) => (
              <Line
                key={s.supplierName}
                type="monotone"
                dataKey={s.supplierName}
                stroke={SERIES_COLORS[s.colorIndex % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        True net cost per {active.uom} — after discounts, freight, surcharges, rebate timing and
        payment terms.
      </p>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  uom,
}: TooltipProps<number, string> & { currency: string; uom: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{formatDate(new Date(Number(label)))}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="tabular mt-1 text-sm">
          <span className="text-muted-foreground">{String(entry.dataKey)}: </span>
          <span className="font-medium">{formatUnitPrice(Number(entry.value), currency)}</span>
          <span className="text-muted-foreground">/{uom}</span>
        </p>
      ))}
    </div>
  );
}
