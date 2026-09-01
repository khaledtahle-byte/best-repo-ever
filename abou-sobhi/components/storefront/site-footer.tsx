import Link from 'next/link';
import { Ltr } from '@/components/ui/ltr';
import { translator, pick } from '@/lib/i18n';
import { telLink, whatsappLink } from '@/lib/share';
import { formatPhone } from '@/lib/phone';
import type { DayHours, Locale, StoreSettings } from '@/lib/types';

const DAY_NAMES: Record<Locale, string[]> = {
  ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export function SiteFooter({ settings, locale }: { settings: StoreSettings; locale: Locale }) {
  const t = translator(locale);

  return (
    <footer className="mt-16 bg-brand-ink text-white/80">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-black text-white">
            {pick(locale, settings.storeNameAr, settings.storeNameEn)}
          </p>
          <p className="mt-1 text-sm">{pick(locale, settings.addressAr, settings.addressEn)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={telLink(settings.phone)} className="btn-yellow btn-sm">
              {t('callUs')} · <Ltr>{formatPhone(settings.phone)}</Ltr>
            </a>
            {settings.whatsapp ? (
              <a
                href={whatsappLink(
                  settings.whatsapp,
                  locale === 'ar' ? 'مرحبا، بدي اطلب شاورما' : 'Hi, I would like to order',
                )}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-sm border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                {t('whatsapp')}
              </a>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[.15em] text-brand-yellow">
            {locale === 'ar' ? 'أوقات الدوام' : 'Opening hours'}
          </p>
          <ul className="space-y-1 text-sm tabular-nums">
            {settings.hours.map((day: DayHours, index) => (
              <li key={index} className="flex justify-between gap-4">
                <span>{DAY_NAMES[locale][index]}</span>
                <span className="font-semibold text-white">
                  {day.closed ? (locale === 'ar' ? 'مسكّر' : 'Closed') : `${day.open} – ${day.close}`}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="sm:text-end">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/track" className="font-semibold hover:text-brand-yellow">
                {t('trackOrder')}
              </Link>
            </li>
            <li>
              <Link href="/admin" className="font-semibold hover:text-brand-yellow">
                {t('adminPanel')}
              </Link>
            </li>
          </ul>
          <p className="mt-6 text-xs text-white/40">
            © {new Date().getFullYear()} {pick(locale, settings.storeNameAr, settings.storeNameEn)}
          </p>
        </div>
      </div>
    </footer>
  );
}
