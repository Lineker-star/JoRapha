# supabase/

Placeholder from Step 0.1. Step 0.2 runs `supabase init`, links `jorapha-dev` and adds `config.toml`.

- `migrations/` — one SQL file per change, never edited after merge
- `functions/` — Edge Functions: sync-ingest, livekit-token, payments-webhook, notify, ai-gateway
- `tests/` — pgTAP tests for RLS and SQL functions (allowed and denied roles)
- `seed.sql` — synthetic data only
