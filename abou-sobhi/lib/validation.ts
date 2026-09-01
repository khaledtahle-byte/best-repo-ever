import { z } from 'zod';
import { isValidLebanesePhone, normaliseLebanesePhone } from './phone';
import { MAX_LINES, MAX_QTY_PER_LINE } from './pricing';

const trimmed = (max: number) => z.string().trim().max(max);

export const cartLineSchema = z.object({
  productSlug: z.string().trim().min(1).max(80),
  variantKind: z.enum(['sandwich', 'platter', 'baguette']),
  addonSlugs: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE),
  notes: trimmed(200).default(''),
});

/**
 * Lebanon has no postal addressing, so the map pin is the address: for a
 * delivery the coordinates are mandatory and the text fields are the driver's
 * supporting detail, not the other way round.
 */
export const checkoutSchema = z
  .object({
    fulfilment: z.enum(['delivery', 'pickup']),
    customerName: trimmed(60).min(2),
    phone: z.string().trim().min(6).max(24).refine(isValidLebanesePhone, 'invalid_phone'),
    zoneId: z.number().int().positive().nullable().default(null),
    street: trimmed(120).default(''),
    building: trimmed(60).default(''),
    floor: trimmed(30).default(''),
    landmark: trimmed(120).default(''),
    lat: z.number().min(-90).max(90).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    notes: trimmed(300).default(''),
    payment: z.enum(['cash_lbp', 'cash_usd']).default('cash_lbp'),
    locale: z.enum(['ar', 'en']).default('ar'),
    lines: z.array(cartLineSchema).min(1).max(MAX_LINES),
  })
  .superRefine((value, ctx) => {
    if (value.fulfilment !== 'delivery') return;
    if (value.zoneId === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['zoneId'], message: 'area_required' });
    }
    if (value.lat === null || value.lng === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lat'], message: 'pin_required' });
    }
  })
  .transform((value) => ({
    ...value,
    phone: normaliseLebanesePhone(value.phone) ?? value.phone,
  }));

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const statusSchema = z.object({
  status: z.enum(['new', 'preparing', 'ready', 'delivering', 'done', 'cancelled']),
});
