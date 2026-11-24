import { AreaPlaceholder } from '@/components/AreaPlaceholder';
import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';

export default async function AdminAreaPage({ params }: LocaleParams) {
  await resolveLocaleParam(params);
  return <AreaPlaceholder area="admin" />;
}
