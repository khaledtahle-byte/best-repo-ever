import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getLocale } from '@/lib/locale';
import { dirOf } from '@/lib/i18n';
import { getSettings } from '@/lib/store/settings';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const settings = getSettings();
  const locale = getLocale();
  const name = locale === 'ar' ? settings.storeNameAr : settings.storeNameEn;
  const tagline = locale === 'ar' ? settings.taglineAr : settings.taglineEn;
  return {
    title: { default: `${name} — ${tagline}`, template: `%s · ${name}` },
    description:
      locale === 'ar'
        ? 'اطلب شاورما أبو صبحي أونلاين. حدّد موقعك عالخريطة ونحنا منوصّلك.'
        : 'Order Abou Sobhi shawarma online. Drop a pin on the map and we deliver.',
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: '#17120e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        {/* Loaded at runtime rather than through next/font so a build never
            depends on reaching Google's servers. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font --
            the rule targets the pages router; in the app router a link in the
            root layout is applied to every page, which is the intent here. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
