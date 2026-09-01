import { translator, pick } from '@/lib/i18n';
import { formatLbp } from '@/lib/money';
import type { Locale, StoreSettings } from '@/lib/types';

export function Hero({
  settings,
  locale,
  shopOpen,
  hoursLabel,
}: {
  settings: StoreSettings;
  locale: Locale;
  shopOpen: boolean;
  hoursLabel: string;
}) {
  const t = translator(locale);

  return (
    <section className="relative overflow-hidden bg-brand-yellow">
      <div className="absolute inset-0 spit-stripes opacity-70" aria-hidden="true" />
      <div
        className="absolute -end-16 -top-16 h-64 w-64 rounded-full bg-brand-red/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="container-page relative py-10 sm:py-14">
        <p className="text-xs font-black uppercase tracking-[.2em] text-brand-red">
          {t('heroKicker')}
        </p>
        <h1 className="mt-2 max-w-2xl text-4xl font-black leading-[1.08] tracking-tight text-brand-ink sm:text-6xl">
          {pick(locale, settings.storeNameAr, settings.storeNameEn)}
        </h1>
        <p className="mt-3 max-w-lg text-base font-semibold leading-relaxed text-brand-char sm:text-lg">
          {t('heroSub')}
        </p>

        <dl className="mt-7 flex flex-wrap gap-2.5">
          <Fact
            label={t('deliveryIn')}
            value={`${settings.deliveryMinutes} ${t('minutes')}`}
          />
          {settings.minOrderLbp > 0 ? (
            <Fact label={t('minOrder')} value={formatLbp(settings.minOrderLbp, locale)} />
          ) : null}
          {settings.freeDeliveryOverLbp > 0 ? (
            <Fact label={t('freeOver')} value={formatLbp(settings.freeDeliveryOverLbp, locale)} />
          ) : null}
          <Fact label={t('hoursToday')} value={hoursLabel} />
        </dl>

        {!shopOpen ? (
          <p className="mt-6 inline-block rounded-xl bg-brand-ink px-4 py-3 text-sm font-bold text-brand-yellow shadow-lift">
            {t('closedNotice')}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-ink/10 bg-white/70 px-3.5 py-2 backdrop-blur-sm">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-brand-muted">{label}</dt>
      <dd className="text-sm font-extrabold tabular-nums text-brand-ink">{value}</dd>
    </div>
  );
}
