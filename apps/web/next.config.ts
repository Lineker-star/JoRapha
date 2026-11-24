import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@jorapha/i18n', '@jorapha/ui'],
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default withNextIntl(nextConfig);
