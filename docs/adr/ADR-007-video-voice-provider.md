---
status: Accepted – pending validation
date: 2026-11-25
deciders: Project owner
consulted: Engineering lead, clinical governance, privacy
informed: Security
---

# ADR-007: Video/voice provider and recording policy

## Context and problem statement

PRD-ID-004 requires teleconsultation with video where viable, audio fallback and chat. TA §4/§11 call for
WebRTC via a vetted provider or managed SFU, secure room tokens, access control, **recording off by default**,
clinical consent and fallback. TA §17 lists privacy and clinical review as open items.
Which provider, and what recording policy?

## Decision drivers

- Works on weak networks (audio-only, reconnection).
- Tokens minted server-side for the appointment's participants only.
- Self-hostable to satisfy a possible data-sovereignty requirement (ADR-004).
- Low cost during development and pilot.

## Considered options

1. **LiveKit** (open-source WebRTC SFU): LiveKit Cloud during development, self-hosting possible later.
2. Another managed video API.
3. Self-built WebRTC signalling and TURN.

## Decision outcome

Chosen option: **1 — LiveKit.**

- `livekit-token` Edge Function issues a token only to the appointment's patient/caregiver or active clinician,
  only for a confirmed appointment within its window, for that room only (Playbook Step 3.2).
- Clients start audio-only on weak networks and offer "switch to audio" and "continue by chat".
- **Recording: disabled.** Enabling it later requires a new ADR covering consent, storage location,
  retention and access.

### Consequences

- Good: open source and self-hostable; no lock-in on the media layer.
- Bad: LiveKit Cloud is a processor of call media and metadata — DPA and region are part of ADR-004.
- Note: the Playbook describes the LiveKit Cloud "Build" plan as free with a hard usage cap; check current
  terms before relying on it.

### Confirmation

- Step 3.2 acceptance tests: a third user cannot obtain a room token; requests outside the window fail;
  audio continues on a throttled 2G profile.
- Field test of call quality from the pilot area.
- Privacy and clinical review of the consultation flow recorded here.

## Pros and cons of the options

**LiveKit** — Good: open source, SDKs for web and React Native. Bad: operating it self-hosted needs TURN
and media servers.
**Other managed API** — Good: less to run. Bad: lock-in, region/DPA questions repeat.
**Self-built** — Bad: high effort and risk.

## More information

TA §4, §11, §17; PRD-ID-004; Build Playbook §2 and Step 3.2.
