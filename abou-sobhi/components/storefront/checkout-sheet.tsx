'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Money } from '@/components/ui/money';
import { useCart } from './cart-provider';
import { translator, pick } from '@/lib/i18n';
import { isValidLebanesePhone } from '@/lib/phone';
import { formatLbp } from '@/lib/money';
import type { Fulfilment, Locale, PaymentMethod, StoreSettings, Zone } from '@/lib/types';

const LocationPicker = dynamic(() => import('./location-picker'), {
  ssr: false,
  loading: () => (
    <div className="h-56 w-full animate-pulse rounded-xl border border-brand-line bg-brand-cream sm:h-64" />
  ),
});

interface CheckoutSheetProps {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  zones: Zone[];
  settings: StoreSettings;
  locale: Locale;
}

type FieldErrors = Partial<Record<'customerName' | 'phone' | 'zoneId' | 'pin', string>>;

export function CheckoutSheet({
  open,
  onClose,
  onBack,
  zones,
  settings,
  locale,
}: CheckoutSheetProps) {
  const t = translator(locale);
  const router = useRouter();
  const { lines, subtotal, clear } = useCart();

  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [zoneId, setZoneId] = useState<number | null>(zones[0]?.id ?? null);
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('cash_lbp');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const qualifiesFree =
    settings.freeDeliveryOverLbp > 0 && subtotal >= settings.freeDeliveryOverLbp;
  const deliveryFee =
    fulfilment === 'delivery' && zone && !qualifiesFree ? zone.feeLbp : 0;
  const total = subtotal + deliveryFee;

  const belowMinimum = settings.minOrderLbp > 0 && subtotal < settings.minOrderLbp;

  const serverMessages = useMemo<Record<string, string>>(
    () => ({
      empty_cart: locale === 'ar' ? 'سلتك فاضية.' : 'Your cart is empty.',
      unknown_item:
        locale === 'ar'
          ? 'في صنف بسلتك ما عاد متوفّر. حدّثنا سلتك.'
          : 'An item in your cart is no longer available. Your cart has been updated.',
      unavailable:
        locale === 'ar'
          ? 'في صنف بسلتك نفد. حدّثنا سلتك.'
          : 'An item in your cart is sold out. Your cart has been updated.',
      unknown_zone: locale === 'ar' ? 'المنطقة المختارة مش متاحة.' : 'That delivery area is not available.',
      below_minimum: `${t('minOrderWarning')} ${formatLbp(settings.minOrderLbp, locale)}`,
      shop_closed: t('closedNotice'),
      invalid: locale === 'ar' ? 'في معلومات ناقصة أو غلط.' : 'Some details are missing or invalid.',
      server: locale === 'ar' ? 'صار خلل. جرّب كمان مرة.' : 'Something went wrong. Please try again.',
    }),
    [locale, settings.minOrderLbp, t],
  );

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (customerName.trim().length < 2) next.customerName = t('required');
    if (!isValidLebanesePhone(phone)) next.phone = t('invalidPhone');
    if (fulfilment === 'delivery') {
      if (!zoneId) next.zoneId = t('areaRequired');
      if (!pin) next.pin = t('pinRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setSubmitError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fulfilment,
          customerName: customerName.trim(),
          phone: phone.trim(),
          zoneId: fulfilment === 'delivery' ? zoneId : null,
          street: street.trim(),
          building: building.trim(),
          floor: floor.trim(),
          landmark: landmark.trim(),
          lat: fulfilment === 'delivery' ? pin?.lat ?? null : null,
          lng: fulfilment === 'delivery' ? pin?.lng ?? null : null,
          notes: notes.trim(),
          payment,
          locale,
          lines: lines.map((line) => ({
            productSlug: line.productSlug,
            variantKind: line.variantKind,
            addonSlugs: line.addonSlugs,
            qty: line.qty,
            notes: line.notes,
          })),
        }),
      });

      const payload = (await response.json()) as
        | { ok: true; code: string }
        | { ok: false; error: { code: string } };

      if (!response.ok || !payload.ok) {
        const code = payload.ok === false ? payload.error.code : 'server';
        setSubmitError(serverMessages[code] ?? serverMessages.server);
        return;
      }

      clear();
      router.push(`/order/${payload.code}`);
    } catch {
      setSubmitError(serverMessages.server);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('checkoutTitle')}
      footer={
        <div className="mb-1 space-y-3">
          <dl className="space-y-1 text-sm">
            <Row label={t('subtotal')} value={subtotal} locale={locale} rate={settings.usdRate} />
            {fulfilment === 'delivery' ? (
              <Row
                label={t('deliveryFee')}
                value={deliveryFee}
                locale={locale}
                rate={settings.usdRate}
                free={qualifiesFree}
                freeLabel={locale === 'ar' ? 'مجاني' : 'Free'}
              />
            ) : null}
            <div className="flex items-center justify-between border-t border-brand-line pt-2 text-base font-extrabold text-brand-ink">
              <dt>{t('total')}</dt>
              <dd>
                <Money value={total} locale={locale} rate={settings.usdRate} inline />
              </dd>
            </div>
          </dl>

          {submitError ? (
            <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm font-semibold text-brand-red-dark">
              {submitError}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button type="button" onClick={onBack} className="btn-ghost">
              {locale === 'ar' ? 'رجوع' : 'Back'}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || belowMinimum || !lines.length}
              className="btn-primary flex-1 py-3 text-base"
            >
              {submitting ? t('placingOrder') : t('placeOrder')}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="label">{t('orderType')}</legend>
          <div className="grid grid-cols-2 gap-2">
            <Toggle
              active={fulfilment === 'delivery'}
              onClick={() => setFulfilment('delivery')}
              label={t('delivery')}
            />
            <Toggle
              active={fulfilment === 'pickup'}
              onClick={() => setFulfilment('pickup')}
              label={t('pickup')}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="label">{t('yourDetails')}</legend>
          <Field label={t('fullName')} error={errors.customerName}>
            <input
              className="field"
              value={customerName}
              maxLength={60}
              autoComplete="name"
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </Field>
          <Field label={t('phone')} error={errors.phone}>
            <input
              className="field"
              value={phone}
              maxLength={24}
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('phonePlaceholder')}
            />
          </Field>
        </fieldset>

        {fulfilment === 'delivery' ? (
          <fieldset className="space-y-3">
            <legend className="label">{t('addressTitle')}</legend>
            <p className="-mt-1 rounded-lg bg-brand-yellow-soft px-3 py-2 text-xs font-semibold leading-relaxed text-brand-char">
              {t('addressHint')}
            </p>

            <Field label={t('deliveryArea')} error={errors.zoneId}>
              <select
                className="field"
                value={zoneId ?? ''}
                onChange={(e) => setZoneId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{t('selectArea')}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {pick(locale, z.nameAr, z.nameEn)} — {formatLbp(z.feeLbp, locale)}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <span className="label">{t('pinLocation')}</span>
              <LocationPicker
                center={{ lat: settings.shopLat, lng: settings.shopLng }}
                value={pin}
                onChange={setPin}
                locale={locale}
              />
              {errors.pin ? (
                <p className="mt-1 text-xs font-bold text-brand-red">{errors.pin}</p>
              ) : null}
            </div>

            <Field label={t('street')}>
              <input
                className="field"
                value={street}
                maxLength={120}
                onChange={(e) => setStreet(e.target.value)}
                placeholder={t('streetPlaceholder')}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('building')}>
                <input
                  className="field"
                  value={building}
                  maxLength={60}
                  onChange={(e) => setBuilding(e.target.value)}
                />
              </Field>
              <Field label={t('floor')}>
                <input
                  className="field"
                  value={floor}
                  maxLength={30}
                  onChange={(e) => setFloor(e.target.value)}
                />
              </Field>
            </div>
            <Field label={t('landmark')}>
              <input
                className="field"
                value={landmark}
                maxLength={120}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder={t('landmarkPlaceholder')}
              />
            </Field>
          </fieldset>
        ) : (
          <div className="rounded-xl border border-brand-line bg-white p-4 text-sm">
            <p className="font-bold text-brand-ink">
              {pick(locale, settings.storeNameAr, settings.storeNameEn)}
            </p>
            <p className="mt-0.5 text-brand-muted">
              {pick(locale, settings.addressAr, settings.addressEn)}
            </p>
          </div>
        )}

        <fieldset>
          <legend className="label">{t('paymentMethod')}</legend>
          <div className="grid grid-cols-2 gap-2">
            <Toggle
              active={payment === 'cash_lbp'}
              onClick={() => setPayment('cash_lbp')}
              label={`${t('cash')} — ل.ل`}
            />
            <Toggle
              active={payment === 'cash_usd'}
              onClick={() => setPayment('cash_usd')}
              label={t('cashUsd')}
            />
          </div>
        </fieldset>

        <Field label={t('orderNotes')}>
          <textarea
            className="field min-h-20 resize-y"
            value={notes}
            maxLength={300}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('orderNotesPlaceholder')}
          />
        </Field>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-bold text-brand-red">{error}</span> : null}
    </label>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-xl border-2 px-3 py-3 text-sm font-bold transition',
        active
          ? 'border-brand-ink bg-brand-ink text-white'
          : 'border-brand-line bg-white text-brand-char hover:border-brand-muted',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function Row({
  label,
  value,
  locale,
  rate,
  free,
  freeLabel,
}: {
  label: string;
  value: number;
  locale: Locale;
  rate: number;
  free?: boolean;
  freeLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between text-brand-muted">
      <dt>{label}</dt>
      <dd className="font-bold text-brand-char">
        {free ? (
          <span className="text-state-done">{freeLabel}</span>
        ) : (
          <Money value={value} locale={locale} rate={rate} inline />
        )}
      </dd>
    </div>
  );
}
