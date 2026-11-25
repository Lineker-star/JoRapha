# Architecture decision records

Format: [MADR](https://adr.github.io/madr/) (Markdown Architecture Decision Records), one file per decision.
Source list: Technical Architecture v1.0 §17; build choices: Build Playbook §2.

## Status values used here

| Status                           | Meaning                                                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accepted – pending validation    | We are building on this choice now. It is not final until the validation listed in the ADR's **Confirmation** section passes.                      |
| Open                             | No decision yet. The ADR lists the questions that must be answered and who must answer them. Nothing may depend on an answer that is not recorded. |
| Accepted / Superseded / Rejected | Final states once validated, replaced by a later ADR, or abandoned.                                                                                |

## Index

| ADR                                                   | Decision                                                | Status                        |
| ----------------------------------------------------- | ------------------------------------------------------- | ----------------------------- |
| [ADR-001](ADR-001-modular-monolith-on-supabase.md)    | Modular monolith on Supabase (Postgres, RPC, Edge Fns)  | Accepted – pending validation |
| [ADR-002](ADR-002-offline-sync-and-local-database.md) | Mobile local database, encryption and sync (PowerSync)  | Accepted – pending validation |
| [ADR-003](ADR-003-offline-conflict-policy.md)         | Offline conflict policy by entity                       | Accepted – pending validation |
| [ADR-004](ADR-004-hosting-region-data-sovereignty.md) | Cloud provider, hosting region and data sovereignty     | Open                          |
| [ADR-005](ADR-005-identity-provider-and-mfa.md)       | Identity provider and MFA (Supabase Auth)               | Accepted – pending validation |
| [ADR-006](ADR-006-fhir-release-and-profiles.md)       | FHIR release and national profiles                      | Open                          |
| [ADR-007](ADR-007-video-voice-provider.md)            | Video/voice provider and recording policy (LiveKit)     | Accepted – pending validation |
| [ADR-008](ADR-008-sms-ussd-ivr-aggregator.md)         | SMS/USSD/IVR aggregator and coverage                    | Open                          |
| [ADR-009](ADR-009-payment-providers.md)               | Payment providers and settlement model                  | Open                          |
| [ADR-010](ADR-010-ai-service-and-providers.md)        | AI service, model providers, data processing (deferred) | Accepted – pending validation |

## Rules for these records

- Facts about Cameroonian law, regulators or provider contracts are recorded only with a source
  (document, letter, signed contract). Anything else is written as a question.
- Changing a decision means a new ADR that supersedes the old one; the old file stays.
- Code that depends on an **Open** ADR goes behind an adapter interface (see ADR-008, ADR-009) or waits.

## Template

```markdown
---
status: Open | Accepted – pending validation | Accepted | Superseded by ADR-0XX | Rejected
date: YYYY-MM-DD
deciders: Project owner
consulted:
informed:
---

# ADR-0XX: Title

## Context and problem statement

## Decision drivers

## Considered options

## Decision outcome

(or, for Open ADRs: "Open questions that must be answered")

### Consequences

### Confirmation

## Pros and cons of the options

## More information
```
