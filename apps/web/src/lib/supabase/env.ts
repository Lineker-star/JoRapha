/**
 * Public Supabase settings for the web app (no secrets: the publishable key only, never service_role).
 * Set in apps/web/.env.local for local runs and in the hosting environment; see apps/web/.env.example.
 */
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set (see apps/web/.env.example)',
    );
  }
  return { url, publishableKey };
}
