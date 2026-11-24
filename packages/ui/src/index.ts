/**
 * @jorapha/ui — shared design tokens (and, later, components).
 * Tokens only for now: web uses Tailwind 4 and mobile uses NativeWind/Tailwind 3,
 * so class-based components wait until one Tailwind major is chosen.
 */
export const PACKAGE_NAME = '@jorapha/ui' as const;

export const colors = {
  brand: {
    50: '#ecfdf7',
    100: '#d1faec',
    500: '#0f9f7a',
    600: '#0b8466',
    700: '#0a6a53',
    900: '#073d31',
  },
  ink: {
    900: '#0f172a',
    600: '#475569',
    400: '#94a3b8',
  },
  surface: {
    base: '#ffffff',
    muted: '#f4f7f6',
  },
  // OFF-006: one colour per sync state, used by every sync badge.
  sync: {
    pending: '#b45309',
    syncing: '#1d4ed8',
    synced: '#15803d',
    rejected: '#b91c1c',
    conflict: '#7e22ce',
  },
} as const;

export const radii = { sm: 6, md: 10, lg: 16 } as const;

/** Minimum touch target in dp/px for low-literacy, small-screen use (PRD §10 accessibility). */
export const MIN_TOUCH_TARGET = 48;
