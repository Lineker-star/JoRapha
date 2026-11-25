---
status: Open
date: 2026-11-25
deciders: Project owner, after legal and procurement review
consulted: Cameroonian legal counsel, security, privacy
informed: Engineering
---

# ADR-004: Cloud provider, hosting region and data sovereignty

## Context and problem statement

ADR-001 puts the backend on Supabase; ADR-002, ADR-007 and ADR-010 add PowerSync, LiveKit and an AI
provider. Each stores or processes personal health data somewhere. TA §9.2 names Cameroon
**Law No. 2024/017 of 23 December 2024** on personal data protection as a primary legal reference and says
counsel must determine hosting/transfer controls before production processing. Where may JoRapha's data
be hosted, and under what conditions?

## Facts recorded so far

- Build Playbook §2 states that Supabase regions cover the Americas, Europe and Asia-Pacific with no African
  region, and suggests Frankfurt; it states that hosting outside Cameroon is a cross-border transfer that
  counsel must approve. (Playbook statement — region list to be re-checked against
  [supabase.com/regions](https://supabase.com/regions) when deciding.)
- Current projects, as reported by the Supabase CLI on 2026-11-25 — **synthetic data only**:
  - `JoRapha` (development, `rdozfdblandlqixixczr`): region `eu-west-1`.
  - `JoRapha-staging` (`bqrcsazvrsyzspzpfgrb`): region `eu-north-1`.
    These differ from each other and from the Frankfurt suggestion in the playbook. Neither is a decision.
- No real patient data may be stored anywhere until the playbook section 14 gates pass (CLAUDE.md).

## Decision drivers

- Legal permissibility of hosting and transfer of health data (to be established by counsel).
- Latency and reliability from East, Adamawa and North Cameroon.
- Availability of data processing agreements with each processor.
- Portability: ability to move to self-hosting or another region if required.
- Cost and operational effort.

## Considered options

1. Supabase managed in an EU region (which one to be chosen).
2. Supabase managed in another region.
3. Self-hosted Supabase (and PowerSync, LiveKit) in Cameroon or another approved jurisdiction.
4. Hybrid: managed during pilot, migration path to in-country hosting.

## Open questions that must be answered

Legal (Cameroonian counsel — answers must cite the law, decree or authority):

1. Under Law No. 2024/017, what conditions apply to transferring health data outside Cameroon, and does any
   prior authorization or notification to an authority apply?
2. Is there any sector-specific requirement (health ministry, telemedicine, hosting of health data) that
   requires in-country hosting or a certified host?
3. What are JoRapha's and each vendor's roles (controller / processor / sub-processor)?
4. What contractual clauses are required in the data processing agreements?
5. Do the answers differ for pilot vs production, or for identifiable vs pseudonymized data?

Procurement / technical:

6. Which region(s) give acceptable measured latency from Bertoua and Ngaoundéré? (Measure; do not assume.)
7. Which PowerSync, LiveKit and AI-provider regions and DPAs are available, and do they match the answer to 1?
8. What backup location, RPO and RTO does the chosen plan provide versus TA §13 (RPO ≤ 24 h, RTO ≤ 8 h)?
9. Should development and staging be moved to the same region as the future production project?

## Decision outcome

**Open.** Until decided: synthetic data only; keep every component self-hostable; record each vendor's
region and DPA status in `docs/design/` (data-flow register).

### Consequences

Production project creation (Playbook Phase 7) is blocked on this ADR.

### Confirmation

Written legal opinion referenced here; DPAs signed; latency measured; this ADR moved to Accepted.

## More information

TA §9.2 (legal gate), §12, §13, §17; Build Playbook §2 "Two decisions you must take consciously";
[Law No. 2024/017](https://www.prc.cm/en/news/the-acts/laws/7602).
