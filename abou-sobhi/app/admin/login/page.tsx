import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signIn } from '../actions';
import { SpitMark } from '@/components/storefront/logo';
import { isStaffAuthenticated, hasProductionSecrets } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { translator } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Staff login', robots: { index: false } };

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  if (isStaffAuthenticated()) redirect('/admin');

  const locale = getLocale();
  const t = translator(locale);
  const throttled = searchParams.error === 'throttled';

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <SpitMark className="h-12 w-12 text-white/40" />
          <h1 className="mt-3 text-2xl font-black text-white">{t('adminLogin')}</h1>
        </div>

        <form action={signIn} className="card space-y-4 p-6">
          <label className="block">
            <span className="label">{t('password')}</span>
            <input
              name="password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              className="field"
            />
          </label>

          {searchParams.error ? (
            <p className="rounded-lg bg-brand-red-soft px-3 py-2 text-sm font-bold text-brand-red-dark">
              {throttled
                ? locale === 'ar'
                  ? 'محاولات كتير. جرّب بعد شوي.'
                  : 'Too many attempts. Try again shortly.'
                : t('wrongPassword')}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full py-3">
            {t('signIn')}
          </button>
        </form>

        {!hasProductionSecrets() ? (
          <p className="mt-4 rounded-lg bg-brand-yellow/15 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-brand-yellow">
            {locale === 'ar'
              ? 'وضع التجربة: كلمة السر الافتراضية abousobhi. حطّ ADMIN_PASSWORD و SESSION_SECRET قبل التشغيل الفعلي.'
              : 'Development mode: default password is abousobhi. Set ADMIN_PASSWORD and SESSION_SECRET before going live.'}
          </p>
        ) : null}
      </div>
    </main>
  );
}
