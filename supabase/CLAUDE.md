# supabase/ — conventions for AI sessions

Read the root `CLAUDE.md` first. These rules add to it for anything under `supabase/`.

## Migrations

- One file per change in `migrations/`. Name new files with `pnpm supabase migration new <snake_name>`.
- Never edit a migration after it is merged. Fix forward with a new migration.
- The migration files are the only source of schema truth. Hosted projects receive them through
  `supabase db push` (dev, from a laptop) or CI (staging, production) — never dashboard edits,
  never the Supabase MCP `apply_migration`, never ad-hoc SQL.
- Extensions go in the `extensions` schema (pg_cron in `pg_catalog`, pgmq in its own schema). Never `public`.
- Test-only extensions (pgtap) are created inside the test files, not in migrations.

## Schemas and access (default deny)

- One schema per domain: identity, patient, provider, scheduling, clinical, referral, lab, pharmacy,
  community, billing, content, audit, sync.
- Every table: `enable row level security` in the same migration that creates it, with policies for
  each role that needs access. No policy = no access.
- Grant only what a role needs, per table. Never `grant all … to anon`.
- A schema is added to `config.toml` `[api].schemas` only once all its tables have RLS and tests.
- Clinical tables are append-only: no UPDATE/DELETE policies; corrections are amendment rows (RULE-04).
- State changes go through SQL functions (RPC) with `security invoker` unless a definer is reviewed and justified;
  definer functions set `search_path = ''` and schema-qualify every name.
- Offline-capable writes carry a client UUID and an idempotency key (OFF-004).

## Tests (pgTAP, `supabase/tests/*.test.sql`)

- Each file: `begin; create extension if not exists pgtap with schema extensions; select plan(n); … select * from finish(); rollback;`
- Every policy: at least one allowed-role and one denied-role assertion.

## Seed

- `seed.sql` is synthetic only: names like `Test Patient 001`, emails `@jorapha.test`, fixed UUIDs.
- It runs locally only. Never `db push --include-seed`.

## Secrets

- Never write the `service_role` key, JWT secret or database password into any file, prompt or log.
