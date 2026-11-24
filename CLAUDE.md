# JoRapha — instructions for every AI session

Read this file first. The full build plan is `docs/JoRapha_Build_Playbook.md`; the source specs are in
`docs/specs/` (Markdown converted from the Word originals in `docs/specs/source/`, which remain the source of truth).

## Product

JoRapha (working name for the "Digital Healthcare Ecosystem") is a privately owned, hybrid digital-health
platform piloted in the East, Adamawa and North regions of Cameroon (first site: Bertoua). It connects patients
and caregivers with verified clinicians, facilities, laboratories and pharmacies, and supports community health
workers (CHWs) in low-connectivity settings. Offline-first, privacy-first, clinically accountable.

User groups (PRD §5): patient/caregiver, clinician, facility administrator, CHW, laboratory staff, pharmacy staff,
platform support, platform administrator.

## Stack

| Layer    | Choice                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo | pnpm workspaces + Turborepo, TypeScript strict (TS 6.0 — typescript-eslint does not support 7 yet)                                |
| Web      | Next.js (App Router) + Tailwind 4 + next-intl (fr default, en) — patient, clinician, facility, admin areas                        |
| Mobile   | Expo SDK 58 + Expo Router + NativeWind 4 (Tailwind 3.4) — `apps/patient`, `apps/chw`                                              |
| Backend  | Supabase: Postgres (one schema per domain, PostGIS), RLS, SQL functions (RPC), Edge Functions (Deno), Auth, Storage, Queues, Cron |
| Offline  | PowerSync + SQLCipher; uploads go through the `sync-ingest` Edge Function                                                         |
| Video    | LiveKit (tokens minted server-side)                                                                                               |
| Tests    | Vitest (TS), pgTAP (database), Playwright (web), Maestro (mobile)                                                                 |

Architecture decisions live in `docs/adr/` (ADR-001 … ADR-010, see playbook §2).

## Folder map

```text
apps/web          Next.js — patient web/PWA, clinician portal, facility portal, admin console
apps/patient      Expo — patient & caregiver app (offline-first)
apps/chw          Expo — community health worker app (offline-first)
packages/config   shared tsconfig and ESLint presets
packages/domain   zod schemas, business rules, state machines, shared types
packages/db-types generated Supabase TypeScript types (pnpm db:types) — never hand-edit
packages/sync     PowerSync schema, upload connector, sync-state hooks
packages/fhir     internal model <-> FHIR mapping
packages/i18n     FR/EN UI strings (locales/*.json) and locale utilities
packages/ui       shared design tokens and components
supabase/         migrations/ (never edited after merge), functions/, tests/ (pgTAP), seed.sql (synthetic only)
docs/             specs/, adr/, design/, assets/images/ (source photos used by the apps)
```

## Non-negotiable rules

- Every table has RLS enabled with default deny; every policy has a pgTAP test for allowed and denied roles.
- Clinical records are append-only: corrections create an amendment linked to the original, with author and reason (RULE-04, conflict policy TA §7.3).
- Every write that can come from an offline device carries a client-generated UUID and an idempotency key (OFF-004).
- No `service_role` key in any app; it lives only in Edge Function secrets.
- No personal health data in logs, analytics, SMS bodies, push notification text or AI prompts sent to third parties.
- UI never shows an offline item as received: it shows pending, syncing, synced, rejected or conflict (OFF-006, RULE-03).
- Stock, availability and pricing always display their source and last-updated time (RULE-08).
- AI features never diagnose, prescribe or clear emergencies (RULE-06).
- All user-facing strings go through i18n keys (FR/EN at minimum) from `packages/i18n`. No hard-coded UI text.
- No real patient data anywhere — synthetic data only — until the section 14 gates of the playbook pass.
- Never read or write `.env*` files other than `.env.example`; never put secrets in code, prompts or commits.
- Schema changes only through migration files in git, applied with `supabase db push` (dev) or CI — never the dashboard, the Supabase MCP or ad-hoc SQL. Database conventions: `supabase/CLAUDE.md`.
- One feature per branch (`feat/<module>-<short-name>`); plan first, wait for approval on anything touching security, clinical data or offline sync.

## Performance budget (PRD §10, low-cost Android reference device, p95)

Cold launch ≤ 5 s · local record save ≤ 3 s · offline profile retrieval ≤ 2 s.

## Commands (run from the repo root; work in PowerShell and WSL)

```text
pnpm install            install everything
pnpm dev                run all dev servers (turbo)
pnpm --filter web dev   web only (http://localhost:3000/fr, /en)
pnpm --filter patient start / pnpm --filter chw start   Expo dev servers
pnpm lint | pnpm typecheck | pnpm test | pnpm build
pnpm format             Prettier write
pnpm db:start | db:stop | db:reset | db:lint | db:test   local Supabase stack (needs Docker; see supabase/README.md)
pnpm db:types           regenerate packages/db-types (local stack, or SUPABASE_PROJECT_REF=<ref> for a hosted project)
pnpm supabase <args>    any Supabase CLI command (CLI is a dev dependency)
```

## Definition of done

1. Acceptance tests from the task prompt pass, including at least one denied-access case where data is involved.
2. `pnpm lint`, `pnpm typecheck` and `pnpm test` pass from the root; output pasted in the summary.
3. New strings exist in both `fr.json` and `en.json` (the i18n parity test enforces this).
4. New tables/policies have pgTAP tests; new offline writes have idempotency tests.
5. Security and clinical-safety reviewer subagents have reviewed the diff; every BLOCKER is fixed.
6. The summary lists what changed and anything uncertain.
