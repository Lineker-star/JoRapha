---
status: Accepted – pending validation
date: 2026-11-25
deciders: Project owner
consulted: Engineering lead, security
informed: Clinical governance
---

# ADR-005: Identity provider and MFA

## Context and problem statement

TA §9.1 requires a central or managed identity service with OIDC/OAuth 2.1-compatible flows, MFA for
clinicians, administrators and privileged users, RBAC plus attributes (care relationship, facility, purpose,
consent), short-lived tokens with refresh rotation, session revocation and break-glass access.
Which identity provider do we use?

## Decision drivers

- Authorization must be enforceable in RLS (ADR-001).
- Phone-based sign-in for patients (many may not use email).
- MFA enforceable per role and checkable inside database policies.
- No extra service to host.

## Considered options

1. **Supabase Auth**: phone OTP and email for patients; email + password + TOTP MFA for clinicians, facility
   admins, CHW supervisors and platform staff; custom access-token hook adding roles and facility memberships.
2. External identity provider (e.g. a dedicated OIDC service) federated into Supabase.
3. Custom authentication.

## Decision outcome

Chosen option: **1 — Supabase Auth.**

- Configured in `supabase/config.toml`: minimum password length 12, TOTP MFA enrol/verify on, secure email
  change, JWT expiry 3600 s, refresh-token rotation. Hosted project settings must match (set in the dashboard).
- MFA assurance level (`aal2`) required for clinician/admin areas and checked in RLS.
- Device registration and revocation per Playbook Step 2.1.

### Consequences

- Good: built in, OIDC-compatible, MFA level visible in the JWT for RLS.
- Bad: **phone OTP needs an SMS provider**; Supabase Auth supports only certain SMS providers, which may not
  include the aggregator chosen in ADR-008. Until then SMS is disabled (`[auth.sms]` placeholder).
- Bad: break-glass and attribute-based rules must be built in SQL; not provided by Auth itself.

### Confirmation

- Playbook Step 2.1 acceptance tests: clinician without MFA cannot open `/clinician`; revoked device is
  refused by `sync-ingest` (`DEVICE_REVOKED`).
- Security assessment (TA §17) recorded here.
- Phone OTP verified with a real Cameroon (+237) number through the provider chosen in ADR-008.

## Pros and cons of the options

**Supabase Auth** — Good: integrated with RLS; no extra hosting. Bad: SMS provider list and feature set
are Supabase's.
**External IdP** — Good: richer policies. Bad: another vendor, DPA and region question (ADR-004).
**Custom** — Bad: security risk; rejected.

## More information

TA §9.1, §17; PRD-ID-001; Build Playbook §2 and Step 2.1.
