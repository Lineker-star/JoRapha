import type { ReactNode } from 'react';

import { resolveLocaleParam, type LocaleParams } from '@/i18n/params';
import { requireArea } from '@/lib/auth/session';

/** Every page of the clinician area goes through the access gate (sign-in, role, MFA for staff). */
export default async function ClinicianAreaLayout({
  children,
  params,
}: LocaleParams & { children: ReactNode }) {
  const locale = await resolveLocaleParam(params);
  await requireArea('clinician', locale);
  return children;
}
