---
status: Accepted – pending validation
date: 2026-11-25
deciders: Project owner
consulted: Engineering lead
informed: Clinical Governance Committee, privacy
---

# ADR-010: AI service, model providers, data processing and evaluation

## Context and problem statement

TA §4 proposes a separately deployable Python + FastAPI AI service. TA §10 limits AI to navigation,
education from approved content, consultation preparation and plain-language explanation of clinician-issued
documents, and excludes diagnosis, prescription, medication changes and emergency clearance (RULE-06). AI is
a later release, gated by the Clinical Governance Committee; TA §17 lists this ADR as open behind a governance
gate. When and how do we build the AI service, and with which provider?

## Decision drivers

- No AI before governance approval; feature flag off in production until then.
- Clients never call a model provider; identifiable health data never sent to third parties
  (TA §10, CLAUDE.md).
- No Python service to run before it is needed.
- Every call auditable: model/version, prompt policy version, retrieved sources, abstain/escalate flags.

## Considered options

1. **Deferred; then an `ai-gateway` Edge Function calling the Claude API**, Python added only for own models.
2. Python + FastAPI service now (TA §4 baseline).
3. Clients calling a model provider directly — rejected by TA §10.

## Decision outcome

Chosen option: **1 — deferred; `ai-gateway` Edge Function when Phase 6 starts.**

- The Edge Function is the only path to a model; the provider key exists only as an Edge Function secret.
- De-identification before sending; danger-sign detection runs before the model; retrieval only from approved,
  versioned content; kill switch and per-user rate limits (Playbook Step 6.1).
- No patient data used for training (RULE-12).

### Consequences

- Good: nothing to build or operate until the gate opens.
- Bad: the model provider is a processor; its data-retention and training terms must be confirmed in
  writing (open question below) and its processing location is part of ADR-004.

### Open items to resolve before Phase 6

1. The provider's current data-retention, no-training and processing-location terms (from the contract/DPA).
2. Clinical Governance Committee approval of scope and the evaluation set (Playbook Step 6.2).
3. Evaluation results per language (FR/EN first; Fulfulde and Gbaya with native reviewers, TA §10).

### Confirmation

Step 6.1 acceptance tests (kill switch, identifiers absent from outgoing requests, dose question refused)
and Step 6.2 evaluation pass; governance approval recorded here.

## More information

TA §4, §10, §17; BRS RULE-06, RULE-12; PRD-ID-013; Build Playbook §2 and Phase 6.
