'use client';

import { useId, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import type { Fee, OfferInput, OfferLineInput } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

/* Values are held as strings so a field can be cleared while typing. */

interface LineDraft {
  key: string;
  description: string;
  sku: string;
  quantity: string;
  packSize: string;
  uom: string;
  quotedUnitPrice: string;
  discountPct: string;
  sellUnitPrice: string;
  confidence: number;
  tiers: OfferLineInput['tiers'];
  rebate: OfferLineInput['rebate'];
}

interface FeeDraft {
  key: string;
  label: string;
  amount: string;
  basis: Fee['basis'];
}

export interface OfferDraft {
  supplierName: string;
  reference: string;
  currency: string;
  lines: LineDraft[];
  netDays: string;
  discountPct: string;
  discountDays: string;
  freightFlat: string;
  freightPerUnit: string;
  freightFreeAbove: string;
  freightAllocation: 'value' | 'quantity';
  fees: FeeDraft[];
  rebatePct: string;
  rebateThresholdQty: string;
  rebateLagDays: string;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

let seq = 0;
const nextKey = () => `row-${(seq += 1)}`;

function num(value: string): number {
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyLine(): LineDraft {
  return {
    key: nextKey(),
    description: '',
    sku: '',
    quantity: '',
    packSize: '1',
    uom: 'unit',
    quotedUnitPrice: '',
    discountPct: '',
    sellUnitPrice: '',
    confidence: 1,
    tiers: [],
    rebate: null,
  };
}

/** Turns a parsed offer (or nothing at all) into an editable draft. */
export function draftFromOffer(offer: OfferInput | null): OfferDraft {
  if (!offer) {
    return {
      supplierName: '',
      reference: '',
      currency: 'USD',
      lines: [emptyLine()],
      netDays: '30',
      discountPct: '',
      discountDays: '',
      freightFlat: '',
      freightPerUnit: '',
      freightFreeAbove: '',
      freightAllocation: 'value',
      fees: [],
      rebatePct: '',
      rebateThresholdQty: '',
      rebateLagDays: '90',
    };
  }

  return {
    supplierName: offer.supplierName ?? '',
    reference: offer.reference ?? '',
    currency: offer.currency ?? 'USD',
    lines:
      offer.lines.length > 0
        ? offer.lines.map((line) => ({
            key: nextKey(),
            description: line.description,
            sku: line.sku ?? '',
            quantity: String(line.quantity ?? ''),
            packSize: String(line.packSize ?? 1),
            uom: line.uom || 'unit',
            quotedUnitPrice: String(line.quotedUnitPrice ?? ''),
            discountPct: line.discountPct ? String(line.discountPct) : '',
            sellUnitPrice: line.sellUnitPrice ? String(line.sellUnitPrice) : '',
            confidence: line.confidence ?? 1,
            tiers: line.tiers ?? [],
            rebate: line.rebate ?? null,
          }))
        : [emptyLine()],
    netDays: String(offer.paymentTerms.netDays ?? 30),
    discountPct: offer.paymentTerms.discountPct ? String(offer.paymentTerms.discountPct) : '',
    discountDays: offer.paymentTerms.discountDays ? String(offer.paymentTerms.discountDays) : '',
    freightFlat: offer.freight.flatPerOrder ? String(offer.freight.flatPerOrder) : '',
    freightPerUnit: offer.freight.perUnit ? String(offer.freight.perUnit) : '',
    freightFreeAbove:
      offer.freight.freeAboveOrderValue !== null ? String(offer.freight.freeAboveOrderValue) : '',
    freightAllocation: offer.freight.allocation ?? 'value',
    fees: (offer.fees ?? []).map((fee) => ({
      key: nextKey(),
      label: fee.label,
      amount: String(fee.amount),
      basis: fee.basis,
    })),
    rebatePct: offer.rebate?.pct ? String(offer.rebate.pct) : '',
    rebateThresholdQty: offer.rebate?.thresholdQty ? String(offer.rebate.thresholdQty) : '',
    rebateLagDays: String(offer.rebate?.lagDays ?? 90),
  };
}

export function draftToOffer(draft: OfferDraft): OfferInput {
  return {
    supplierName: draft.supplierName.trim(),
    reference: draft.reference.trim() || null,
    currency: draft.currency,
    quotedAt: new Date().toISOString(),
    lines: draft.lines
      .filter((line) => line.description.trim() && num(line.quotedUnitPrice) > 0)
      .map((line) => ({
        description: line.description.trim(),
        sku: line.sku.trim() || null,
        quantity: num(line.quantity) || 1,
        packSize: num(line.packSize) || 1,
        uom: line.uom.trim() || 'unit',
        quotedUnitPrice: num(line.quotedUnitPrice),
        discountPct: num(line.discountPct),
        tiers: line.tiers ?? [],
        rebate: line.rebate ?? null,
        sellUnitPrice: num(line.sellUnitPrice) || null,
        confidence: line.confidence,
      })),
    paymentTerms: {
      netDays: num(draft.netDays),
      discountPct: num(draft.discountPct),
      discountDays: num(draft.discountDays),
    },
    freight: {
      flatPerOrder: num(draft.freightFlat),
      perUnit: num(draft.freightPerUnit),
      freeAboveOrderValue: draft.freightFreeAbove.trim() ? num(draft.freightFreeAbove) : null,
      allocation: draft.freightAllocation,
    },
    fees: draft.fees
      .filter((fee) => fee.label.trim() && num(fee.amount) > 0)
      .map((fee) => ({ label: fee.label.trim(), amount: num(fee.amount), basis: fee.basis })),
    rebate: num(draft.rebatePct)
      ? {
          pct: num(draft.rebatePct),
          thresholdQty: draft.rebateThresholdQty.trim() ? num(draft.rebateThresholdQty) : null,
          thresholdValue: null,
          lagDays: num(draft.rebateLagDays) || 90,
          scope: 'order' as const,
        }
      : null,
  };
}

/**
 * Deriving the id from the label alone repeated it on every line row, so a
 * label click focused the first row's input instead of its own. useId gives
 * each instance its own.
 */
function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} {...props} />
    </div>
  );
}

export function OfferEditor({
  draft,
  onChange,
  onSubmit,
  submitting,
  title = 'Check the numbers',
  description = 'Correct anything that was read wrongly. These values drive the analysis.',
}: {
  draft: OfferDraft;
  onChange: (draft: OfferDraft) => void;
  onSubmit: () => void;
  submitting: boolean;
  title?: string;
  description?: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(draft.fees.length || draft.rebatePct || draft.freightFlat || draft.freightFreeAbove),
  );

  const set = <K extends keyof OfferDraft>(key: K, value: OfferDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const setLine = (index: number, patch: Partial<LineDraft>) => {
    const lines = draft.lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
    onChange({ ...draft, lines });
  };

  const goodsTotal = useMemo(
    () =>
      draft.lines.reduce(
        (acc, line) =>
          acc + num(line.quantity) * num(line.quotedUnitPrice) * (1 - num(line.discountPct) / 100),
        0,
      ),
    [draft.lines],
  );

  const validLines = draft.lines.filter((l) => l.description.trim() && num(l.quotedUnitPrice) > 0).length;
  const canSubmit = validLines > 0 && draft.supplierName.trim().length > 0 && !submitting;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline" className="tabular">
            {formatCurrency(goodsTotal, draft.currency)} of goods
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Supplier"
            value={draft.supplierName}
            onChange={(e) => set('supplierName', e.target.value)}
            placeholder="Northside Food Supply"
            required
          />
          <Field
            label="Quote reference"
            value={draft.reference}
            onChange={(e) => set('reference', e.target.value)}
            placeholder="Q-4417"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Select value={draft.currency} onValueChange={(value) => set('currency', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Line items</h3>
            <span className="text-xs text-muted-foreground">
              {validLines} of {draft.lines.length} ready
            </span>
          </div>

          <div className="space-y-3">
            {draft.lines.map((line, index) => (
              <div
                key={line.key}
                className={cn(
                  'rounded-lg border p-4',
                  line.confidence < 0.6 ? 'border-review/40 bg-review/[0.04]' : 'border-border',
                )}
              >
                <div className="grid gap-3 md:grid-cols-12">
                  <Field
                    label="Description"
                    className="md:col-span-5"
                    value={line.description}
                    onChange={(e) => setLine(index, { description: e.target.value })}
                    placeholder="Mozzarella 2.5kg block"
                  />
                  <Field
                    label="SKU"
                    className="md:col-span-2"
                    value={line.sku}
                    onChange={(e) => setLine(index, { sku: e.target.value })}
                    placeholder="MOZ-25"
                  />
                  <Field
                    label="Quantity"
                    className="md:col-span-2"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => setLine(index, { quantity: e.target.value })}
                    placeholder="120"
                  />
                  <Field
                    label="Unit price"
                    className="md:col-span-2"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={line.quotedUnitPrice}
                    onChange={(e) => setLine(index, { quotedUnitPrice: e.target.value })}
                    placeholder="18.40"
                  />
                  <div className="flex items-end md:col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-bad"
                      onClick={() =>
                        onChange({
                          ...draft,
                          lines:
                            draft.lines.length === 1
                              ? [emptyLine()]
                              : draft.lines.filter((_, i) => i !== index),
                        })
                      }
                      aria-label={`Remove line ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-12">
                  <Field
                    label="Pack size"
                    className="md:col-span-3"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={line.packSize}
                    onChange={(e) => setLine(index, { packSize: e.target.value })}
                    placeholder="1"
                  />
                  <Field
                    label="Unit of measure"
                    className="md:col-span-3"
                    value={line.uom}
                    onChange={(e) => setLine(index, { uom: e.target.value })}
                    placeholder="kg"
                  />
                  <Field
                    label="Line discount %"
                    className="md:col-span-3"
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    inputMode="decimal"
                    value={line.discountPct}
                    onChange={(e) => setLine(index, { discountPct: e.target.value })}
                    placeholder="6"
                  />
                  <Field
                    label="Your sell price"
                    className="md:col-span-3"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={line.sellUnitPrice}
                    onChange={(e) => setLine(index, { sellUnitPrice: e.target.value })}
                    placeholder="optional"
                  />
                </div>

                {line.confidence < 0.6 ? (
                  <p className="mt-3 text-xs text-review">
                    This line was hard to read — check the quantity and price before analysing.
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...draft, lines: [...draft.lines, emptyLine()] })}
          >
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Payment terms</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Net days"
              type="number"
              min="0"
              value={draft.netDays}
              onChange={(e) => set('netDays', e.target.value)}
              placeholder="30"
            />
            <Field
              label="Early-payment discount %"
              type="number"
              min="0"
              step="any"
              value={draft.discountPct}
              onChange={(e) => set('discountPct', e.target.value)}
              placeholder="2"
            />
            <Field
              label="Paid within (days)"
              type="number"
              min="0"
              value={draft.discountDays}
              onChange={(e) => set('discountDays', e.target.value)}
              placeholder="10"
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {showAdvanced ? 'Hide' : 'Add'} freight, surcharges and rebates
          </button>

          {showAdvanced ? (
            <div className="mt-4 space-y-6 rounded-lg border border-border p-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Freight</h3>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field
                    label="Per order"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.freightFlat}
                    onChange={(e) => set('freightFlat', e.target.value)}
                    placeholder="145"
                  />
                  <Field
                    label="Per unit"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.freightPerUnit}
                    onChange={(e) => set('freightPerUnit', e.target.value)}
                    placeholder="0"
                  />
                  <Field
                    label="Free above"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.freightFreeAbove}
                    onChange={(e) => set('freightFreeAbove', e.target.value)}
                    placeholder="5000"
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Allocate by</Label>
                    <Select
                      value={draft.freightAllocation}
                      onValueChange={(value) => set('freightAllocation', value as 'value' | 'quantity')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value">Line value</SelectItem>
                        <SelectItem value="quantity">Quantity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Surcharges</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onChange({
                        ...draft,
                        fees: [...draft.fees, { key: nextKey(), label: '', amount: '', basis: 'order' }],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>

                {draft.fees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Fuel levies, pallet fees, drop charges — anything outside the unit price.
                  </p>
                ) : (
                  draft.fees.map((fee, index) => (
                    <div key={fee.key} className="grid gap-3 sm:grid-cols-[1fr_140px_180px_auto]">
                      <Field
                        label="Label"
                        value={fee.label}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            fees: draft.fees.map((f, i) =>
                              i === index ? { ...f, label: e.target.value } : f,
                            ),
                          })
                        }
                        placeholder="Fuel surcharge"
                      />
                      <Field
                        label="Amount"
                        type="number"
                        min="0"
                        step="any"
                        value={fee.amount}
                        onChange={(e) =>
                          onChange({
                            ...draft,
                            fees: draft.fees.map((f, i) =>
                              i === index ? { ...f, amount: e.target.value } : f,
                            ),
                          })
                        }
                        placeholder="4"
                      />
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Basis</Label>
                        <Select
                          value={fee.basis}
                          onValueChange={(value) =>
                            onChange({
                              ...draft,
                              fees: draft.fees.map((f, i) =>
                                i === index ? { ...f, basis: value as Fee['basis'] } : f,
                              ),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="order">Flat per order</SelectItem>
                            <SelectItem value="unit">Per unit</SelectItem>
                            <SelectItem value="percent_of_goods">% of goods</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-bad"
                          onClick={() =>
                            onChange({ ...draft, fees: draft.fees.filter((_, i) => i !== index) })
                          }
                          aria-label="Remove surcharge"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Volume rebate</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field
                    label="Rebate %"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.rebatePct}
                    onChange={(e) => set('rebatePct', e.target.value)}
                    placeholder="3"
                  />
                  <Field
                    label="Qualifying units"
                    type="number"
                    min="0"
                    step="any"
                    value={draft.rebateThresholdQty}
                    onChange={(e) => set('rebateThresholdQty', e.target.value)}
                    placeholder="500"
                  />
                  <Field
                    label="Paid after (days)"
                    type="number"
                    min="0"
                    value={draft.rebateLagDays}
                    onChange={(e) => set('rebateLagDays', e.target.value)}
                    placeholder="90"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {canSubmit
              ? 'Nothing else is needed — run the analysis.'
              : 'Add a supplier name and at least one line with a price.'}
          </p>
          <Button onClick={onSubmit} disabled={!canSubmit} size="lg">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Analyse this offer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
