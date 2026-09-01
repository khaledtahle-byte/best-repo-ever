import { formatLbp } from './money';
import { formatCode } from './order-code';
import type { Locale, Order } from './types';
import { pick } from './i18n';
import { toInternational } from './phone';

/** A pin the driver can open in Google Maps, Waze or anything else. */
export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function wazeLink(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat.toFixed(6)},${lng.toFixed(6)}&navigate=yes`;
}

export function telLink(phone: string): string {
  return `tel:+${toInternational(phone) ?? phone.replace(/\D/g, '')}`;
}

export function whatsappLink(phone: string, message: string): string {
  const international = toInternational(phone) ?? phone.replace(/\D/g, '');
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}

const VARIANT_LABEL: Record<string, { ar: string; en: string }> = {
  sandwich: { ar: 'سندويش', en: 'Sandwich' },
  platter: { ar: 'صحن', en: 'Platter' },
  baguette: { ar: 'باجيت', en: 'Baguette' },
};

export function variantLabel(kind: string, locale: Locale): string {
  const entry = VARIANT_LABEL[kind];
  if (!entry) return kind;
  return locale === 'ar' ? entry.ar : entry.en;
}

/**
 * WhatsApp is how orders are confirmed in Lebanon, so the whole order is
 * rendered as plain text the customer or the shop can forward as-is.
 */
export function orderAsText(order: Order, locale: Locale, storeName: string): string {
  const lines: string[] = [];
  lines.push(locale === 'ar' ? `طلب من ${storeName}` : `Order from ${storeName}`);
  lines.push(`${locale === 'ar' ? 'رقم الطلب' : 'Order'}: ${formatCode(order.code)}`);
  lines.push('');

  for (const item of order.items) {
    const name = pick(locale, item.nameAr, item.nameEn);
    lines.push(`${item.qty}× ${name} — ${variantLabel(item.variantKind, locale)}`);
    for (const addon of item.addons) {
      lines.push(`   + ${pick(locale, addon.nameAr, addon.nameEn)}`);
    }
    if (item.notes) lines.push(`   (${item.notes})`);
  }

  lines.push('');
  lines.push(`${locale === 'ar' ? 'المجموع' : 'Subtotal'}: ${formatLbp(order.subtotalLbp, locale)}`);
  if (order.deliveryFeeLbp > 0) {
    lines.push(`${locale === 'ar' ? 'التوصيل' : 'Delivery'}: ${formatLbp(order.deliveryFeeLbp, locale)}`);
  }
  lines.push(`${locale === 'ar' ? 'الإجمالي' : 'Total'}: ${formatLbp(order.totalLbp, locale)}`);

  if (order.fulfilment === 'delivery') {
    lines.push('');
    lines.push(locale === 'ar' ? 'العنوان:' : 'Address:');
    const zone = pick(locale, order.zoneNameAr, order.zoneNameEn);
    const parts = [zone, order.street, order.building && `${locale === 'ar' ? 'بناية' : 'Bldg'} ${order.building}`, order.floor && `${locale === 'ar' ? 'طابق' : 'Floor'} ${order.floor}`, order.landmark]
      .filter(Boolean)
      .join('، ');
    lines.push(parts);
    if (order.lat !== null && order.lng !== null) lines.push(mapsLink(order.lat, order.lng));
  }

  if (order.notes) {
    lines.push('');
    lines.push(`${locale === 'ar' ? 'ملاحظات' : 'Notes'}: ${order.notes}`);
  }

  return lines.join('\n');
}
