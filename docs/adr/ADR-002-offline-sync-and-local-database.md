---
status: Accepted – pending validation
date: 2026-11-25
deciders: Project owner
consulted: Engineering lead
informed: Clinical governance, security
---

# ADR-002: Mobile local database, encryption and synchronization

## Context and problem statement

The patient and CHW apps must work offline (PRD OFF-001…OFF-010, TA §7): durable encrypted local storage,
a visible per-record sync state (pending, syncing, synced, rejected, conflict), idempotent uploads and
server-side validation. TA §4 proposes encrypted SQLite on mobile and a custom sync service.
How do we store and synchronize data on the device?

## Decision drivers

- Encryption at rest on the device; key held in secure storage (TA §9.2).
- Server keeps full control of validation, authorization, idempotency and conflicts on upload (TA §7.2).
- Performance budget on a low-cost Android device (CLAUDE.md: local save ≤ 3 s, offline profile ≤ 2 s,
  cold launch ≤ 5 s, p95).
- Minimal custom sync code to maintain; self-hostable option (ADR-004).

## Considered options

1. **PowerSync** (Postgres → SQLite sync) with SQLCipher via `@powersync/op-sqlite`; uploads sent to our own
   `sync-ingest` Edge Function.
2. **Custom sync service** over encrypted SQLite (TA §4 baseline).
3. Other sync engines (not evaluated in detail yet).

## Decision outcome

Chosen option: **1 — PowerSync + SQLCipher, uploads through `sync-ingest`**, pending the Phase 1.4 spike.

- Download: PowerSync sync rules scope each device to what its user may hold (e.g. a CHW's catchment).
- Upload: the connector sends batches to `supabase/functions/sync-ingest`, which validates JWT, role,
  scope and payload (zod), applies operations transactionally, records each idempotency key in
  `sync.operation` and returns per-operation ack/reject with reason codes.
- Every offline write carries a client-generated UUID and an idempotency key (CLAUDE.md, OFF-004).
- Local key generated on first launch and stored with `expo-secure-store`.
- Code lives in `packages/sync`.

### Consequences

- Good: no custom replication protocol to build; server-side rules unchanged by the sync engine.
- Bad: PowerSync is an additional service (cloud or self-hosted) and a data processor (ADR-004, DPA needed).
- Bad: SQLCipher and native modules add build complexity under Expo; device support must be proven.
- Fallback if the spike fails: option 2, reusing the same `sync-ingest` contract.

### Confirmation

Go / no-go from Build Playbook Step 1.4, reported in `docs/design/offline-spike-report.md`, run on a
low-cost Android phone (not an emulator): airplane-mode creates ×20, app killed mid-upload, duplicate batch,
device clock 2 days wrong, reboot with pending items — no lost or duplicated operations, and the
performance budget met.

## Pros and cons of the options

**PowerSync** — Good: mature Postgres→SQLite sync, SQLCipher support, self-hostable. Bad: extra service,
licensing/hosting terms to confirm.
**Custom sync** — Good: full control, no extra vendor. Bad: large, error-prone engineering effort.

## More information

TA §4, §7.1, §7.2, §13, §15; PRD §7 (OFF-001…010); Build Playbook §2 and Step 1.4. Conflict rules: ADR-003.
