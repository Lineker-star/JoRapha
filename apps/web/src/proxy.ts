// Next.js 16 renamed middleware to "proxy". Redirects "/" to the user's locale and keeps the prefix.
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, Vercel internals and files with an extension (images, favicon…).
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
