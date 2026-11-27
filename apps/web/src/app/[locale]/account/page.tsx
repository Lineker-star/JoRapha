import { getFormatter, getTranslations } from 'next-intl/server';

import { redirect } from '@/i18n/navigation';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { revokeMyDevice, signOut, signOutEverywhere } from '@/lib/auth/actions';
import { getAuthState } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface DeviceRow {
  id: string;
  app: string;
  platform: string;
  app_version: string | null;
  trust_status: 'active' | 'revoked';
  last_sync_at: string | null;
}

/** My account: my registered devices (revocable), sign out, sign out everywhere (Step 2.1). */
export default async function AccountPage({ params }: LocaleParams) {
  const locale = await resolveLocaleParam(params);
  const state = await getAuthState();
  if (!state.signedIn || !state.userId)
    redirect({ href: '/sign-in?next=' + encodeURIComponent(`/${locale}/account`), locale });

  const supabase = await createSupabaseServerClient();
  // RLS lets admins read every device; this page shows only my own.
  const { data } = await supabase
    .schema('identity')
    .from('device_registration')
    .select('id, app, platform, app_version, trust_status, last_sync_at')
    .eq('user_account_id', state.userId ?? '')
    .order('created_at', { ascending: false });
  const devices = (data ?? []) as DeviceRow[];
  const t = await getTranslations('auth.account');
  const format = await getFormatter();

  return (
    <section className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('devices')}</h2>
        <p className="text-ink-600">{t('devicesIntro')}</p>
        {devices.length === 0 ? (
          <p className="text-ink-600">{t('noDevices')}</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <dt className="text-ink-600">{t('app')}</dt>
                  <dd>{d.app}</dd>
                  <dt className="text-ink-600">{t('platform')}</dt>
                  <dd>{d.platform}</dd>
                  <dt className="text-ink-600">{t('lastSync')}</dt>
                  <dd>
                    {d.last_sync_at
                      ? format.dateTime(new Date(d.last_sync_at), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : t('never')}
                  </dd>
                  <dt className="text-ink-600">{t('status')}</dt>
                  <dd>{d.trust_status === 'active' ? t('active') : t('revoked')}</dd>
                </dl>
                {d.trust_status === 'active' ? (
                  <form action={revokeMyDevice}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="deviceId" value={d.id} />
                    <button
                      type="submit"
                      className="min-h-12 rounded-lg border border-red-300 px-4 font-medium text-red-800 hover:bg-red-50"
                    >
                      {t('revoke')}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t('sessions')}</h2>
        <div className="flex flex-wrap gap-3">
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="min-h-12 rounded-lg border border-slate-300 px-4 font-medium hover:bg-surface-muted"
            >
              {t('signOut')}
            </button>
          </form>
          <form action={signOutEverywhere}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              className="min-h-12 rounded-lg bg-red-700 px-4 font-semibold text-white hover:bg-red-800"
            >
              {t('signOutEverywhere')}
            </button>
          </form>
        </div>
        <p className="text-sm text-ink-600">{t('signOutEverywhereHint')}</p>
      </div>
    </section>
  );
}
