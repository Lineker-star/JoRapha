import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { areaHref, areas } from '@/lib/areas';

export default async function HomePage({ params }: LocaleParams) {
  await resolveLocaleParam(params);
  const t = await getTranslations();

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/hero-corridor.webp"
          alt={t('home.heroAlt')}
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-right"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-white via-white/85 to-white/10" />
        <div className="mx-auto max-w-5xl px-4 py-16 md:py-24">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
            {t('home.title')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-600">{t('common.tagline')}</p>
          <p className="mt-2 max-w-xl text-ink-600">{t('home.intro')}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-xl font-semibold">{t('home.chooseArea')}</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {areas.map(({ id, image }) => (
            <li key={id}>
              <Link
                href={areaHref(id)}
                className="group block overflow-hidden rounded-2xl border border-slate-200 transition hover:border-brand-500 hover:shadow-md"
              >
                <Image
                  src={image}
                  alt={t(`areas.${id}.imageAlt`)}
                  width={900}
                  height={600}
                  className="h-44 w-full object-cover"
                />
                <div className="p-5">
                  <h3 className="font-semibold group-hover:text-brand-700">
                    {t(`areas.${id}.title`)}
                  </h3>
                  <p className="mt-1 text-sm text-ink-600">{t(`areas.${id}.description`)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
