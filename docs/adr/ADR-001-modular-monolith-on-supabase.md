---
status: Accepted – pending validation
date: 2026-11-25
deciders: Project owner
consulted: Engineering lead
informed: Clinical governance, security
---

# ADR-001: Modular monolith on Supabase for the initial release

## Context and problem statement

Technical Architecture v1.0 (§2, §4, §15) prescribes an API-first **modular monolith**, not microservices,
to keep early operations simple, with NestJS, PostgreSQL/PostGIS, Redis and a durable job/outbox pattern.
The team is small and AI-assisted, so every component it must run is a cost and a risk.
Which concrete runtime implements the modular monolith?

## Decision drivers

- Few moving parts to operate during the pilot (TA §15 "over-complex early infrastructure").
- Access control that client code — much of it AI-written — cannot bypass.
- Clear domain boundaries that allow later extraction (TA §1, §5).
- Portability and no proprietary lock-in for clinical data (TA §2, §15).
- Durable jobs and outbox without a separate cache/queue server.

## Considered options

1. **Supabase**: Postgres with one schema per domain, Row Level Security, state changes through SQL
   functions (RPC), integrations in Edge Functions (Deno/TypeScript), Queues (pgmq) + pg_cron + outbox table.
2. **NestJS modular monolith** + managed PostgreSQL/PostGIS + Redis + job runner (the TA §4 baseline).
3. **Microservices** per domain.

## Decision outcome

Chosen option: **1 — Supabase as the modular monolith**, because it implements the TA principles with about
three operated components instead of about eight (Playbook §2), and RLS enforces access in the database.

- Domain modules = Postgres schemas: `identity, patient, provider, scheduling, clinical, referral, lab,
pharmacy, community, billing, content, audit, sync` (created in `supabase/migrations/0001_extensions.sql`).
- Writes that carry business rules go through SQL functions; integrations through Edge Functions only.
- Redis is replaced by pgmq + pg_cron + an outbox table; PostGIS stays.
- File storage: Supabase Storage, private buckets, short-lived signed URLs.

### Consequences

- Good: one deployable backend, migrations in git, RLS default-deny on every table with pgTAP tests (CLAUDE.md).
- Good: Supabase is open source, so self-hosting remains possible (relevant to ADR-004).
- Bad: business logic split between SQL and Edge Functions; needs conventions (`supabase/CLAUDE.md`)
  and strong database tests.
- Bad: dependency on Supabase's managed-service terms, regions and limits (see ADR-004).
- Neutral: the "API-first, versioned REST" principle is met by PostgREST/RPC plus Edge Functions; external
  partner APIs still need explicit versioned contracts.

### Confirmation

Validated when:

- Phase 1 foundation migrations ship with RLS and pgTAP tests for allowed and denied roles in CI.
- The Phase 1.4 offline spike (ADR-002) works end to end against this backend.
- A load test at expected pilot volumes meets TA §13 objectives on the chosen Supabase plan.

## Pros and cons of the options

**Supabase** — Good: managed Postgres/PostGIS, Auth, Storage, Queues in one place; RLS. Bad: logic in SQL is
harder for some developers; vendor limits.
**NestJS** — Good: familiar layered code, matches TA §4. Bad: more services to host and secure; access
control lives only in application code.
**Microservices** — Bad: rejected by TA §2/§15 for the initial release.

## More information

TA §2, §4, §5, §15 and §17; Build Playbook §2 "What changes and why".
