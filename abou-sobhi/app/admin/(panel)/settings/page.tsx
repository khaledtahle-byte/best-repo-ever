import type { Metadata } from 'next';
import { saveSettingsAction, saveZonesAction } from '../../settings-actions';
import { getDb } from '@/lib/db';
import { getSettings } from '@/lib/store/settings';
import { listZones } from '@/lib/store/zones';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';
import { groupDigits } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Settings' };

const DAY_NAMES = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const;

export default function AdminSettingsPage({ searchParams }: { searchParams: { saved?: string } }) {
  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const settings = getSettings(db);
  const zones = listZones(db);

  return (
    <main className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="section-title">{t('storeSettings')}</h1>
        {searchParams.saved ? (
          <span className="rounded-full bg-state-done/15 px-3 py-1 text-xs font-black text-state-done">
            ✓ {t('saved')}
          </span>
        ) : null}
      </div>

      <form action={saveSettingsAction} className="grid gap-5 xl:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-black uppercase tracking-wide text-brand-muted">
            {locale === 'ar' ? 'هوية المحل' : 'Identity'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Text name="store_name_ar" label={`${t('storeName')} (AR)`} value={settings.storeNameAr} />
            <Text name="store_name_en" label={`${t('storeName')} (EN)`} value={settings.storeNameEn} />
            <Text name="tagline_ar" label="Tagline (AR)" value={settings.taglineAr} />
            <Text name="tagline_en" label="Tagline (EN)" value={settings.taglineEn} />
            <Text name="phone" label={t('storePhone')} value={settings.phone} dir="ltr" />
            <Text name="whatsapp" label={t('whatsappNumber')} value={settings.whatsapp} dir="ltr" />
            <Text name="address_ar" label={`${locale === 'ar' ? 'العنوان' : 'Address'} (AR)`} value={settings.addressAr} />
            <Text name="address_en" label={`${locale === 'ar' ? 'العنوان' : 'Address'} (EN)`} value={settings.addressEn} />
            <Text name="shop_lat" label="Latitude" value={String(settings.shopLat)} dir="ltr" />
            <Text name="shop_lng" label="Longitude" value={String(settings.shopLng)} dir="ltr" />
          </div>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-black uppercase tracking-wide text-brand-muted">
            {locale === 'ar' ? 'الطلبات والأسعار' : 'Orders & pricing'}
          </h2>

          <label className="flex items-center gap-3 rounded-xl bg-brand-paper px-3 py-2.5">
            <input
              type="checkbox"
              name="accepting_orders"
              defaultChecked={settings.acceptingOrders}
              className="h-4 w-4 accent-state-done"
            />
            <span className="text-sm font-extrabold text-brand-ink">{t('acceptingOrders')}</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              name="usd_rate"
              label={t('usdRate')}
              value={groupDigits(settings.usdRate)}
              hint={t('usdRateHint')}
              dir="ltr"
            />
            <Text
              name="prep_minutes"
              label={t('prepMinutes')}
              value={String(settings.prepMinutes)}
              dir="ltr"
            />
            <Text
              name="delivery_minutes"
              label={`${t('deliveryIn')} (${t('minutes')})`}
              value={String(settings.deliveryMinutes)}
              dir="ltr"
            />
            <Text
              name="min_order_lbp"
              label={t('minOrderLbp')}
              value={groupDigits(settings.minOrderLbp)}
              dir="ltr"
            />
            <Text
              name="free_delivery_over_lbp"
              label={t('freeDeliveryOver')}
              value={groupDigits(settings.freeDeliveryOverLbp)}
              dir="ltr"
            />
          </div>
        </section>

        <section className="card p-4 xl:col-span-2">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-brand-muted">
            {locale === 'ar' ? 'أوقات الدوام' : 'Opening hours'}
          </h2>
          <p className="mb-3 text-xs font-semibold text-brand-muted">
            {locale === 'ar'
              ? 'إذا وقت الإقفال أبكر من وقت الفتح، معناها المحل بيسكّر بعد منتصف الليل.'
              : 'A closing time earlier than the opening time means the shop closes after midnight.'}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {settings.hours.map((day, index) => (
              <div key={index} className="rounded-xl border border-brand-line bg-brand-paper p-3">
                <p className="mb-2 text-sm font-extrabold text-brand-ink">
                  {DAY_NAMES[locale][index]}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    name={`open_${index}`}
                    defaultValue={day.open}
                    dir="ltr"
                    className="field px-2 py-1.5 text-sm tabular-nums"
                  />
                  <input
                    type="time"
                    name={`close_${index}`}
                    defaultValue={day.close}
                    dir="ltr"
                    className="field px-2 py-1.5 text-sm tabular-nums"
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-xs font-bold text-brand-muted">
                  <input
                    type="checkbox"
                    name={`closed_${index}`}
                    defaultChecked={day.closed}
                    className="h-3.5 w-3.5 accent-brand-red"
                  />
                  {locale === 'ar' ? 'مسكّر هالنهار' : 'Closed this day'}
                </label>
              </div>
            ))}
          </div>
        </section>

        <div className="xl:col-span-2">
          <button type="submit" className="btn-primary w-full py-3 sm:w-auto sm:px-10">
            {t('save')}
          </button>
        </div>
      </form>

      <form action={saveZonesAction} className="card p-4">
        <input type="hidden" name="zone_ids" value={zones.map((z) => z.id).join(',')} />
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-brand-muted">
          {t('zones')}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-wide text-brand-muted">
                <th className="px-2 py-2 text-start">{t('zoneName')} (AR)</th>
                <th className="px-2 py-2 text-start">{t('zoneName')} (EN)</th>
                <th className="px-2 py-2 text-start">{t('zoneFee')}</th>
                <th className="px-2 py-2 text-start">{t('deleteZone')}</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className={zone.active ? '' : 'opacity-40'}>
                  <td className="px-2 py-1.5">
                    <input
                      name={`zone_name_ar_${zone.id}`}
                      defaultValue={zone.nameAr}
                      className="field py-1.5"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      name={`zone_name_en_${zone.id}`}
                      defaultValue={zone.nameEn}
                      className="field py-1.5"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      name={`zone_fee_${zone.id}`}
                      defaultValue={groupDigits(zone.feeLbp)}
                      inputMode="numeric"
                      dir="ltr"
                      className="field w-32 py-1.5 text-center tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      name={`zone_delete_${zone.id}`}
                      className="h-4 w-4 accent-brand-red"
                      aria-label={`${t('deleteZone')} ${zone.nameEn}`}
                    />
                  </td>
                </tr>
              ))}
              <tr className="border-t border-brand-line">
                <td className="px-2 pt-3">
                  <input
                    name="new_zone_name_ar"
                    placeholder={locale === 'ar' ? 'منطقة جديدة' : 'New area (AR)'}
                    className="field py-1.5"
                  />
                </td>
                <td className="px-2 pt-3">
                  <input
                    name="new_zone_name_en"
                    placeholder="New area (EN)"
                    className="field py-1.5"
                  />
                </td>
                <td className="px-2 pt-3">
                  <input
                    name="new_zone_fee"
                    placeholder="150,000"
                    inputMode="numeric"
                    dir="ltr"
                    className="field w-32 py-1.5 text-center tabular-nums"
                  />
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <button type="submit" className="btn-ink mt-4">
          {t('save')}
        </button>
      </form>
    </main>
  );
}

function Text({
  name,
  label,
  value,
  hint,
  dir,
}: {
  name: string;
  label: string;
  value: string;
  hint?: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} defaultValue={value} dir={dir} className="field" />
      {hint ? <span className="mt-1 block text-xs text-brand-muted">{hint}</span> : null}
    </label>
  );
}
