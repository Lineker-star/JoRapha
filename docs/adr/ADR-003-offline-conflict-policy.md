---
status: Accepted – pending validation
date: 2026-11-25
deciders: Project owner
consulted: Engineering lead
informed: Clinical governance
---

# ADR-003: Offline conflict policy by entity

## Context and problem statement

When offline devices sync (ADR-002), the same record can change in two places. A single rule such as
last-write-wins is unsafe for clinical data. TA §7.3 proposes a policy per entity type; TA §17 notes that
clinical review is required. Which policy applies to each entity, and where is it enforced?

## Decision drivers

- Clinical records are append-only; corrections are amendments with author, reason and link (RULE-04).
- The UI never shows an offline item as received (OFF-006, RULE-03).
- Server-authoritative state for bookings, stock and payments (TA §7.3).
- Server time is authoritative for receipt and audit; device time kept as device-reported (TA §7.2).

## Considered options

1. **Per-entity policy from TA §7.3, enforced in `sync-ingest` and SQL functions.**
2. Last-write-wins everywhere.
3. Manual resolution of every conflict.

## Decision outcome

Chosen option: **1**, adopted as the working policy until the Clinical Governance review confirms it.

| Data type             | Policy                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------- |
| Patient demographics  | Field-level merge for non-sensitive fields; conflict queue for identity-critical changes.     |
| Clinical observations | Append-only; corrections create an amendment with author, reason and link to the original.    |
| Encounter notes       | Versioned, attributed amendments; signed/finalized notes are never silently overwritten.      |
| Appointments          | Server-controlled booking state; an offline request is a request, not a confirmed booking.    |
| Pharmacy stock        | Server/partner source is authoritative; offline stock is a stale snapshot with its timestamp. |
| Payments              | Gateway-confirmed state is authoritative; the client can never mark a payment as settled.     |
| Consent               | Consent and withdrawal events are versioned and checked before any later processing.          |

### Consequences

- Good: no silent loss of clinical data; every conflict is visible and attributable.
- Bad: a conflict queue and amendment UI must be built and staffed.
- Open detail: which demographic fields are "identity-critical" — to be listed with clinical governance.

### Confirmation

- Clinical Governance Committee signs off the table above (record the date and reference here).
- Automated tests per entity: concurrent edits produce the specified outcome; duplicate delivery is
  idempotent; no clinical row is ever updated in place.

## Pros and cons of the options

**Per-entity** — Good: safe and explainable. Bad: more code paths.
**Last-write-wins** — Bad: silently loses clinical data; rejected by TA §7.2.
**Manual for all** — Bad: unworkable volume for CHW sync.

## More information

TA §7.2, §7.3, §17; BRS RULE-03, RULE-04; PRD OFF-006.
