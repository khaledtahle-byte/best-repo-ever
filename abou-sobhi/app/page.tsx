import { SiteHeader } from '@/components/storefront/site-header';
import { SiteFooter } from '@/components/storefront/site-footer';
import { Hero } from '@/components/storefront/hero';
import { Storefront } from '@/components/storefront/storefront';
import { getDb } from '@/lib/db';
import { getMenu } from '@/lib/store/menu';
import { listZones } from '@/lib/store/zones';
import { getSettings, isShopOpen } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { beirutParts } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const locale = getLocale();
  const db = getDb();
  const settings = getSettings(db);
  const menu = getMenu(db, { activeOnly: true });
  const zones = listZones(db, { activeOnly: true });
  const shopOpen = isShopOpen(settings);

  const today = settings.hours[beirutParts().weekday];
  const hoursLabel = today?.closed
    ? locale === 'ar'
      ? 'مسكّر'
      : 'Closed'
    : `${today?.open ?? ''} – ${today?.close ?? ''}`;

  return (
    <>
      <SiteHeader settings={settings} locale={locale} shopOpen={shopOpen} returnTo="/" />
      <Hero settings={settings} locale={locale} shopOpen={shopOpen} hoursLabel={hoursLabel} />
      <main>
        <Storefront
          menu={menu}
          zones={zones}
          settings={settings}
          locale={locale}
          shopOpen={shopOpen}
        />
      </main>
      <SiteFooter settings={settings} locale={locale} />
    </>
  );
}
