/** The four web areas (route groups) and their illustration in public/images. */
export const areas = [
  { id: 'patient', image: '/images/area-patient.webp' },
  { id: 'clinician', image: '/images/area-clinician.webp' },
  { id: 'facility', image: '/images/area-facility.webp' },
  { id: 'admin', image: '/images/area-admin.webp' },
] as const;

export type AreaId = (typeof areas)[number]['id'];

export function areaHref(id: AreaId): `/${AreaId}` {
  return `/${id}`;
}
