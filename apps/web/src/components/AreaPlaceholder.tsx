import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { areas, type AreaId } from '@/lib/areas';

export async function AreaPlaceholder({ area }: { area: AreaId }) {
  const t = await getTranslations();
  const image = areas.find((a) => a.id === area)?.image;

  return (
    <section className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2 md:items-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(`areas.${area}.title`)}</h1>
        <p className="mt-3 text-ink-600">{t(`areas.${area}.description`)}</p>
        <p className="mt-6 rounded-lg bg-brand-50 px-4 py-3 text-brand-900">
          {t('common.underConstruction')}
        </p>
        <Link href="/" className="mt-6 inline-block font-medium text-brand-700 hover:underline">
          {t('common.backHome')}
        </Link>
      </div>
      {image ? (
        <Image
          src={image}
          alt={t(`areas.${area}.imageAlt`)}
          width={900}
          height={600}
          priority
          className="h-64 w-full rounded-2xl object-cover md:h-80"
        />
      ) : null}
    </section>
  );
}
