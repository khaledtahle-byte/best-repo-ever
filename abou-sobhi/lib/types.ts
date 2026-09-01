import type { VariantKind } from './db/menu-data';
import type { DayHours } from './time';
import type { Locale } from './i18n';

export type { VariantKind, DayHours, Locale };

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivering' | 'done' | 'cancelled';
export type Fulfilment = 'delivery' | 'pickup';
export type PaymentMethod = 'cash_lbp' | 'cash_usd';

export const ORDER_STATUSES: OrderStatus[] = [
  'new',
  'preparing',
  'ready',
  'delivering',
  'done',
  'cancelled',
];

/** Statuses the kitchen still has work to do on. */
export const OPEN_STATUSES: OrderStatus[] = ['new', 'preparing', 'ready', 'delivering'];

/**
 * The next step a member of staff can move an order to. A pickup order never
 * goes out for delivery, so it steps straight from ready to handed over.
 */
export function nextStatuses(status: OrderStatus, fulfilment: Fulfilment): OrderStatus[] {
  switch (status) {
    case 'new':
      return ['preparing', 'cancelled'];
    case 'preparing':
      return ['ready', 'cancelled'];
    case 'ready':
      return fulfilment === 'delivery' ? ['delivering', 'cancelled'] : ['done', 'cancelled'];
    case 'delivering':
      return ['done', 'cancelled'];
    default:
      return [];
  }
}

export interface Addon {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  priceLbp: number;
  active: boolean;
}

export interface Variant {
  id: number;
  kind: VariantKind;
  priceLbp: number;
  active: boolean;
}

export interface Product {
  id: number;
  slug: string;
  categorySlug: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  badge: string;
  active: boolean;
  addonSlugs: string[];
  variants: Variant[];
}

export interface Category {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  active: boolean;
  products: Product[];
}

export interface Menu {
  categories: Category[];
  addons: Addon[];
}

export interface Zone {
  id: number;
  nameAr: string;
  nameEn: string;
  feeLbp: number;
  active: boolean;
}

export interface StoreSettings {
  storeNameAr: string;
  storeNameEn: string;
  taglineAr: string;
  taglineEn: string;
  phone: string;
  whatsapp: string;
  addressAr: string;
  addressEn: string;
  shopLat: number;
  shopLng: number;
  /** LBP per USD; 0 hides dollar prices everywhere. */
  usdRate: number;
  prepMinutes: number;
  deliveryMinutes: number;
  minOrderLbp: number;
  freeDeliveryOverLbp: number;
  acceptingOrders: boolean;
  hours: DayHours[];
}

export interface OrderItemAddon {
  slug: string;
  nameAr: string;
  nameEn: string;
  priceLbp: number;
}

export interface OrderItem {
  id: number;
  productSlug: string;
  nameAr: string;
  nameEn: string;
  variantKind: VariantKind;
  unitPriceLbp: number;
  addons: OrderItemAddon[];
  addonsTotalLbp: number;
  qty: number;
  lineTotalLbp: number;
  notes: string;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
}

export interface Order {
  id: number;
  code: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customerName: string;
  phone: string;
  zoneId: number | null;
  zoneNameAr: string;
  zoneNameEn: string;
  street: string;
  building: string;
  floor: string;
  landmark: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  payment: PaymentMethod;
  subtotalLbp: number;
  deliveryFeeLbp: number;
  totalLbp: number;
  usdRate: number;
  locale: Locale;
  businessDay: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  events: OrderEvent[];
}

/** What the browser sends. Prices are deliberately absent — the server prices it. */
export interface CartLineInput {
  productSlug: string;
  variantKind: VariantKind;
  addonSlugs: string[];
  qty: number;
  notes?: string;
}
