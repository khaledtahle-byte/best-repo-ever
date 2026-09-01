import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { signOut } from '../actions';
import { AdminNav, type NavItem } from '@/components/admin/admin-nav';
import { SpitMark } from '@/components/storefront/logo';
import { isStaffAuthenticated, hasProductionSecrets } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { countOrders } from '@/lib/store/orders';
import { getSettings, isShopOpen } from '@/lib/store/settings';
import { getLocale } from '@/lib/locale';
import { translator, pick } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!isStaffAuthenticated()) redirect('/admin/login');

  const locale = getLocale();
  const t = translator(locale);
  const db = getDb();
  const settings = getSettings(db);
  const newCount = countOrders({ statuses: ['new'] }, db);
  const open = isShopOpen(settings);

  // Only serialisable data crosses into the client nav — names, not elements.
  const items: NavItem[] = [
    { href: '/admin', label: t('liveOrders'), icon: 'board', badge: newCount },
    { href: '/admin/orders', label: t('allOrders'), icon: 'orders' },
    { href: '/admin/menu', label: t('menuManager'), icon: 'menu' },
    { href: '/admin/reports', label: t('reports'), icon: 'reports' },
    { href: '/admin/settings', label: t('settings'), icon: 'settings' },
  ];

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="no-print bg-brand-ink text-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2">
            <SpitMark className="h-7 w-7" />
            <span className="text-sm font-black leading-tight">
              {pick(locale, settings.storeNameAr, settings.storeNameEn)}
              <span className="block text-[10px] font-bold uppercase tracking-wider text-white/50">
                {t('adminPanel')}
              </span>
            </span>
          </Link>
          <span
            className={[
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              open ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300',
            ].join(' ')}
          >
            {open ? t('openNow') : t('closedNow')}
          </span>
        </div>

        <div className="px-3 pb-3">
          <AdminNav items={items} />
        </div>

        <div className="hidden px-3 lg:mt-auto lg:block">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-2.5 text-start text-sm font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              {t('signOut')}
            </button>
          </form>
          <Link
            href="/"
            className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            {locale === 'ar' ? 'شوف الموقع' : 'View storefront'}
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {!hasProductionSecrets() ? (
          <p className="no-print bg-brand-yellow px-4 py-2 text-center text-xs font-bold text-brand-ink">
            {locale === 'ar'
              ? 'تنبيه: عم تستعمل كلمة السر الافتراضية. حطّ ADMIN_PASSWORD و SESSION_SECRET.'
              : 'Warning: running on the default password. Set ADMIN_PASSWORD and SESSION_SECRET.'}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
