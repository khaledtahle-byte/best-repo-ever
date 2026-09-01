import { z } from 'zod';

/** Wire-format validation for anything that reaches the analysis engine. */

export const quantityTierSchema = z.object({
  minQty: z.number().finite().min(0).max(10_000_000),
  discountPct: z.number().finite().min(0).max(100).default(0),
  unitPrice: z.number().finite().min(0).max(10_000_000).nullish(),
});

export const rebateSchema = z.object({
  pct: z.number().finite().min(0).max(100),
  thresholdQty: z.number().finite().min(0).max(10_000_000).nullish(),
  thresholdValue: z.number().finite().min(0).max(1_000_000_000).nullish(),
  lagDays: z.number().finite().min(0).max(730).default(90),
  scope: z.enum(['line', 'order']).default('order'),
  label: z.string().max(200).nullish(),
});

export const paymentTermsSchema = z.object({
  netDays: z.number().finite().min(0).max(365).default(30),
  discountPct: z.number().finite().min(0).max(100).default(0),
  discountDays: z.number().finite().min(0).max(365).default(0),
  raw: z.string().max(120).nullish(),
});

export const freightSchema = z.object({
  flatPerOrder: z.number().finite().min(0).max(1_000_000).default(0),
  perUnit: z.number().finite().min(0).max(1_000_000).default(0),
  freeAboveOrderValue: z.number().finite().min(0).max(100_000_000).nullable().default(null),
  allocation: z.enum(['value', 'quantity']).default('value'),
});

export const feeSchema = z.object({
  label: z.string().min(1).max(80),
  amount: z.number().finite().min(0).max(1_000_000),
  basis: z.enum(['order', 'unit', 'percent_of_goods']),
});

export const offerLineSchema = z.object({
  raw: z.string().max(2000).nullish(),
  description: z.string().min(1, 'Every line needs a description.').max(300),
  sku: z.string().max(80).nullish(),
  quantity: z.number().finite().min(0).max(10_000_000),
  packSize: z.number().finite().min(0.0001).max(1_000_000).default(1),
  uom: z.string().min(1).max(24).default('unit'),
  quotedUnitPrice: z.number().finite().min(0).max(10_000_000),
  discountPct: z.number().finite().min(0).max(100).default(0),
  tiers: z.array(quantityTierSchema).max(20).default([]),
  rebate: rebateSchema.nullish(),
  fees: z.array(feeSchema).max(10).optional(),
  sellUnitPrice: z.number().finite().min(0).max(10_000_000).nullish(),
  confidence: z.number().finite().min(0).max(1).optional(),
});

export const offerInputSchema = z.object({
  supplierName: z.string().min(1, 'Add the supplier name.').max(160),
  reference: z.string().max(80).nullish(),
  currency: z.string().length(3).default('USD'),
  quotedAt: z.string().datetime().nullish(),
  lines: z.array(offerLineSchema).min(1, 'Add at least one line item.').max(500),
  paymentTerms: paymentTermsSchema,
  freight: freightSchema,
  fees: z.array(feeSchema).max(20).default([]),
  rebate: rebateSchema.nullish(),
  notes: z.string().max(4000).nullish(),
});

export const analyzeRequestSchema = z.object({
  offer: offerInputSchema,
  sourceType: z.enum(['pdf', 'csv', 'xlsx', 'text', 'manual', 'api']).default('manual'),
  fileName: z.string().max(255).nullish(),
  rawText: z.string().max(200_000).nullish(),
  confidence: z.number().min(0).max(1).optional(),
});

export const parseTextRequestSchema = z.object({
  text: z.string().min(1, 'Paste the offer first.').max(200_000),
});

export const counterOfferRequestSchema = z.object({
  offerId: z.string().uuid(),
  tone: z.enum(['collaborative', 'firm']).default('collaborative'),
  supplierContact: z.string().max(120).nullish(),
  deadlineDays: z.number().int().min(1).max(60).default(5),
  save: z.boolean().default(true),
});

export const checkoutRequestSchema = z.object({
  plan: z.enum(['pro', 'business']),
});

export const settingsRequestSchema = z.object({
  fullName: z.string().max(120).nullish(),
  companyName: z.string().max(160).nullish(),
  costOfCapitalPct: z.number().min(0).max(100),
  targetMarginPct: z.number().min(0).max(100),
  defaultCurrency: z.string().length(3),
});

export const apiKeyRequestSchema = z.object({
  name: z.string().min(1).max(60).default('Default key'),
});

/** Turns a Zod error into one readable sentence for a toast. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'The request was not valid.';
  const path = issue.path.filter((p) => typeof p === 'string').join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}
