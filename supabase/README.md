# supabase/

Database, auth and Edge Functions for JoRapha. **Migrations in `migrations/` are the only way the
schema changes** — never the dashboard, never ad-hoc SQL against a hosted project.

| Path          | Holds                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| `config.toml` | Local stack settings (auth, MFA, ports). Applies to the **local** stack only.      |
| `migrations/` | One SQL file per change. Never edited after merge — add a new file instead.        |
| `functions/`  | Edge Functions (sync-ingest, livekit-token, payments-webhook, notify, ai-gateway). |
| `tests/`      | pgTAP tests: every policy tested for an allowed and a denied role.                 |
| `seed.sql`    | Synthetic data for the **local** stack only (`Test Patient 001`, `@jorapha.test`). |

Projects: `jorapha-dev` = `rdozfdblandlqixixczr`. Staging and production come later.

All commands run from the **repo root**. The Supabase CLI is a dev dependency, so use `pnpm supabase …`
(no global install needed). Every command works in PowerShell and in WSL.

## 1. Start Docker

The local stack (Postgres, Auth, Storage, Studio…) runs in Docker containers.

1. Install **Docker Desktop** for Windows and choose the **WSL 2 backend** (Settings → General →
   "Use the WSL 2 based engine").
2. Start Docker Desktop and wait until it says **Engine running**.
3. Check: `docker info` prints server details without an error.

If Smart App Control or antivirus blocks Docker, run the repo from WSL 2 Ubuntu instead
(playbook §3, "Windows setup").

## 2. Start the local stack

```sh
pnpm db:start          # = pnpm supabase start; first run downloads images (several GB, be patient)
```

It applies every migration, then `seed.sql`, and prints local URLs and keys:

- Studio: http://127.0.0.1:54323 · API: http://127.0.0.1:54321 · DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Mail catcher (sign-up and OTP emails): http://127.0.0.1:54324
- The printed keys are **local-only** demo keys. Put them in `apps/*/.env.local` (git-ignored), never in a committed file.

Stop it with `pnpm db:stop` (data is kept).

## 3. Reset, lint, test, types

```sh
pnpm db:reset          # drop the local DB, re-run all migrations + seed.sql
pnpm db:lint           # supabase db lint — must report no errors
pnpm db:test           # pgTAP tests in supabase/tests
pnpm db:types          # regenerate packages/db-types from the local DB
```

Seeded accounts (local only): `test.patient.001@jorapha.test` … `test.admin.001@jorapha.test`,
password `JoRapha-Local-Only-2026!`.

## 4. Link the dev project

One-time, per machine:

```sh
pnpm supabase login                                   # opens the browser; stores an access token locally
pnpm supabase link --project-ref rdozfdblandlqixixczr # asks for the database password if needed — type it, never save it in a file
```

Then, to apply new migrations to **dev**:

```sh
pnpm supabase db push --remote --dry-run   # shows which migrations would run
pnpm supabase db push --remote             # applies them; never pass --include-seed
SUPABASE_PROJECT_REF=rdozfdblandlqixixczr pnpm db:types   # types straight from dev, no Docker needed
```

PowerShell form of the last line: `$env:SUPABASE_PROJECT_REF='rdozfdblandlqixixczr'; pnpm db:types`.

Rules:

- `db push` only ever targets **dev** from a laptop. Staging and production are deployed by CI (Step 13.2).
- CLI 3 targets the **local** stack by default; `--remote` means the linked project. The CLI labels a
  project's main database "production" even for `jorapha-dev` — check the ref it prints
  (`rdozfdblandlqixixczr`) before confirming.
- Database connections use ports 5432/6543. Some VPNs block them (symptom: "Connection timed out" /
  "terminated unexpectedly" after "Initialising login role"); disconnect the VPN and retry.
- The `service_role` key and the database password are never written to any file in this repo, any
  prompt, or any chat. They live in your password manager and in Edge Function secrets only.
- `config.toml` does not change the hosted project. Hosted auth settings (password length, MFA,
  redirect URLs, phone provider) are set in the dashboard: Authentication → Providers / Policies / URL configuration.
