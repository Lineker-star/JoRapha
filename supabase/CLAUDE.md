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
- Domain schemas get no default grants (0001, 0002), so every table needs explicit grants:
  `grant usage on schema <s> to authenticated, service_role;` then per table only what is needed, e.g.
  `grant select, insert on <s>.<t> to authenticated;` and the same for `service_role` if Edge Functions use it
  (`service_role` bypasses RLS but not missing grants). Never grant to `anon` unless the data is public
  reference data and a comment in the migration says so. Never `grant all`.
- Functions are not executable by default (0002). Grant `execute` per function to the roles that call it.
- No application tables, views or functions in `public`. Never add `extensions`, `pgmq`, `cron` or a domain
  schema to `[api].schemas` until all its tables have RLS and tests; never enable the dashboard toggle
  "Expose Queues via PostgREST". Queue and cron payloads carry ids only, never health data.
- A schema is added to `config.toml` `[api].schemas` only once all its tables have RLS and tests.
- Clinical tables are append-only: no UPDATE/DELETE policies; corrections are amendment rows (RULE-04).
- State changes go through SQL functions (RPC) with `security invoker` unless a definer is reviewed and justified.
  A `security definer` function must: set `search_path = ''`, schema-qualify every name, check the caller's
  authorization inside the function (from `auth.uid()` / JWT claims, never from arguments), and
  `revoke execute on function … from public, anon` before granting execute to the roles that need it.
- Offline-capable writes carry a client UUID and an idempotency key (OFF-004).

## Tests (pgTAP, `supabase/tests/*.test.sql`)

- Each file: `begin; create extension if not exists pgtap with schema extensions; select plan(n); … select * from finish(); rollback;`
- Every policy: at least one allowed-role and one denied-role assertion.

## Seed

- `seed.sql` is synthetic only: names like `Test Patient 001`, emails `@jorapha.test`, fixed UUIDs.
- It runs locally only. Never `db push --include-seed`. Do not enable Supabase Branching (GitHub
  integration) with seeding: preview branches would get the seed's confirmed accounts, whose password is
  public in this repository.
- Roles and facility memberships in JWT claims come only from server-controlled tables (via the custom
  access-token hook), never from `raw_user_meta_data`, which users can set themselves.

## Secrets

- Never write the `service_role` key, JWT secret or database password into any file, prompt or log.
