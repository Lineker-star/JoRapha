---
status: Open
date: 2026-11-25
deciders: Project owner, after merchant due diligence
consulted: Finance, legal, security
informed: Engineering
---

# ADR-009: Payment providers and settlement model

## Context and problem statement

PRD-ID-011 requires price disclosure, payment initiation, confirmation, receipts, refunds and reconciliation.
The Concept Note says MTN Mobile Money and Orange Money integration should be investigated, including merchant
requirements, settlement processes and transaction costs. TA §11 requires payment intents with signed
callbacks, idempotency, reconciliation, refunds and no raw PIN/card storage; TA §17 lists merchant due
diligence as open. Which provider(s), and what settlement model?

## Constraints already fixed (not open)

- The gateway-confirmed state is authoritative; the client can never mark a payment as paid (TA §7.3, ADR-003).
- Secret keys only in Edge Function secrets; webhooks verified by signature and idempotent on provider
  reference (Playbook Step 5.4).
- Amounts stored as integer XAF; platform fee and provider fee shown separately (RULE-11).
- A payment adapter interface so a second provider can be added.

## Candidates named in project documents (not evaluated)

- Direct integration with MTN Mobile Money and/or Orange Money (Concept Note).
- An aggregator; the Playbook gives Notch Pay and CamPay as examples. Their capabilities and terms are
  **not verified** in this repository.

## Open questions that must be answered

Business / legal (from written vendor offers and counsel):

1. Direct operator integration or aggregator? What merchant onboarding does each require from a private
   health company?
2. Fees per transaction and per refund; who bears them; how are they disclosed to patients?
3. Settlement: to whom (JoRapha, or directly to providers/facilities), how often, in which account?
   Does collecting on behalf of providers need a licence or specific contract structure?
4. Refund and dispute process and timelines.
5. Where transaction data is processed and stored; DPA availability (ADR-004).

Technical (from vendor documentation and sandbox):

6. Webhook signature scheme, retry behaviour and a statement/reconciliation API.
7. Sandbox availability for automated tests.

## Decision outcome

**Open.** Until decided: build `billing` tables and the adapter against a mock provider; no live payments.

### Consequences

Paid appointments are blocked on this ADR; free or facility-paid flows are not.

### Confirmation

Signed merchant agreement and DPA referenced here; sandbox payments reconcile to the franc (Playbook Phase 5
exit gate).

## More information

TA §7.3, §11, §17; Concept Note (Mobile Money); PRD-ID-011; Build Playbook Step 5.4.
