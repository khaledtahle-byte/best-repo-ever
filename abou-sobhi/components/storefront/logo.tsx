import { pick } from '@/lib/i18n';
import type { Locale, StoreSettings } from '@/lib/types';

/** The spit-and-skewer mark, drawn rather than shipped as a raster asset. */
export function SpitMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="30" y="2" width="4" height="60" rx="2" fill="currentColor" opacity=".35" />
      <path
        d="M32 10c7 0 12 4 12 9s-5 6-5 6 5 1 5 6-5 6-5 6 5 1 5 6-5 9-12 9-12-4-12-9 5-6 5-6-5-1-5-6 5-6 5-6-5-1-5-6 5-9 12-9z"
        fill="#FFC629"
      />
    </svg>
  );
}

export function Logo({
  settings,
  locale,
  className = '',
}: {
  settings: StoreSettings;
  locale: Locale;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <SpitMark className="h-9 w-9 shrink-0 text-white" />
      <span className="leading-none">
        <span className="block text-lg font-black tracking-tight text-white">
          {pick(locale, settings.storeNameAr, settings.storeNameEn)}
        </span>
        <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[.14em] text-brand-yellow">
          {pick(locale, settings.taglineAr, settings.taglineEn)}
        </span>
      </span>
    </span>
  );
}
