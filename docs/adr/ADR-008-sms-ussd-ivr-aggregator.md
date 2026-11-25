---
status: Open
date: 2026-11-25
deciders: Project owner, after field and commercial validation
consulted: Operations, privacy, telecom/aggregator vendors
informed: Engineering
---

# ADR-008: SMS/USSD/IVR aggregator and coverage

## Context and problem statement

Reminders, notifications and patient phone sign-in (ADR-005) need SMS; USSD and IVR are planned for users
without smartphones. TA §11 requires a provider-abstracted adapter, with the provider **selected after
coverage and commercial assessment**, consent and preferences, delivery status, short-code contracts and no
sensitive detail in plain SMS. Which aggregator(s), and for which channels?

## Constraints already fixed (not open)

- SMS and push text never contain health information (CLAUDE.md; Playbook Step 5.3 template linter).
- Notifications go through an adapter (`notify.outbox` + queue + worker) so the provider can be swapped.
- USSD/IVR stays a mock behind a feature flag until telecom contracts exist (Playbook Step 5.3).

## Open questions that must be answered

Coverage (field validation — measure, do not assume):

1. Which aggregator(s) deliver reliably to the operators used in East, Adamawa and North Regions, and with
   what measured delivery rate and latency?
2. Is a sender ID or short code available and what is the registration process and lead time?

Commercial / contractual (from the vendor's written offer):

3. Price per SMS and per USSD session; minimum volumes; settlement currency.
4. Delivery-receipt and inbound (reply) support; API availability and sandbox.
5. Where the vendor processes and stores message data, and whether a DPA is offered (link to ADR-004).

Integration:

6. Is the chosen aggregator supported by Supabase Auth phone OTP, or do we need a custom OTP path
   (Auth hook) to use it for sign-in (ADR-005)?
7. Which telecom agreements are needed for USSD/IVR, and with whom?

## Decision outcome

**Open.** Until decided: push notifications and email only; SMS adapter built against a sandbox; phone
OTP sign-in disabled outside local testing.

### Consequences

Patient phone sign-in and SMS reminders are blocked on this ADR.

### Confirmation

Field delivery test from the pilot area; signed contract and DPA referenced here.

## More information

TA §11, §17; Build Playbook Steps 2.1 and 5.3.
