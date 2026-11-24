<!-- Converted from docs/specs/source/Digital_Healthcare_Ecosystem_Technical_Architecture_v1.0.docx. The .docx is the source of truth; regenerate rather than hand-edit. -->

**Digital Healthcare Ecosystem**

**Technical Architecture & Solution Design**

_Logical architecture, technology baseline, data, offline sync, security, integrations and deployment_

| Document version | 1.0 |
| --- | --- |
| Date | 21 November 2026 |
| Project ownership | Private enterprise |
| Initial market | East, Adamawa and North Regions, Cameroon |
| Service model | Hybrid digital and physical healthcare |
| Languages | English, French, Fulfulde, Gbaya; extensible local-language support |
| Financing | Phased development and investment |
| Status | Baseline for stakeholder validation; not yet approved for production |

# Document control

| Field | Value |
| --- | --- |
| Architecture owner | Solution Architect / Engineering Lead |
| Reviewers | Clinical governance, security, privacy, product and operations |
| Architecture style | API-first modular monolith with event-driven integration boundaries |
| Deployment model | Cloud-hosted core with offline-capable clients; optional facility edge gateway later |
| Status | Proposed baseline; validate through architecture spikes and legal/partner review |

# 1\. Architecture objectives

-   Support web, Android and iOS experiences against one governed platform backend.
-   Provide useful offline workflows without weakening clinical safety or data protection.
-   Maintain clear domain boundaries and allow future service extraction.
-   Support regional growth and integration with approved external health systems.
-   Minimize operational complexity and cost during early phased delivery.
-   Provide observability, auditability, resilience and recoverability.

# 2\. Architecture principles

| Principle | Design consequence |
| --- | --- |
| Offline-first | Local durable storage, explicit sync states, idempotent APIs and conflict policies. |
| Privacy/security by design | Least privilege, encryption, threat modelling, audit and data minimization. |
| Clinical accountability | Professional attribution, provenance, approval and escalation workflows. |
| Interoperability | FHIR-aligned canonical model and adapters; no direct uncontrolled database sharing. |
| Modular monolith first | Domain modules in one deployable backend initially; stable internal contracts. |
| API-first | Versioned REST APIs and documented integration contracts. |
| Event-driven integration | Outbox/event patterns for notifications and partner integrations; no distributed transactions across providers. |
| Graceful degradation | Core records and field capture continue offline; non-essential media/analytics defer. |
| Open standards and portability | Avoid proprietary lock-in in clinical data and core interfaces. |

# 3\. Logical architecture

The system comprises client applications, an API and identity boundary, domain modules, persistence and integration services. The mobile clients hold a deliberately limited encrypted offline data set. The central platform remains the system of record for synchronized transactions, subject to approved record-authority policies.

| Layer | Components | Responsibilities |
| --- | --- | --- |
| Experience | Patient web/PWA; patient mobile; clinician web; community health worker mobile; facility portals; admin console; future USSD/IVR. | Role-specific interfaces, localization, accessibility and offline user experience. |
| Edge/API | API gateway/reverse proxy; authentication; rate limiting; API versioning; request validation. | Secure entry point, token validation, quotas and request routing. |
| Application domain | Identity; patient; provider; facility; scheduling; encounter; EHR; referral; laboratory; pharmacy; community health; billing; notification; content; reporting. | Business rules, permissions, workflows and domain validation. |
| Platform services | Sync service; file service; job queue; notification adapters; audit service; search; feature flags. | Cross-cutting functions and asynchronous processing. |
| Data | PostgreSQL; PostGIS; Redis; object storage; encrypted client SQLite/IndexedDB; backup vault. | Transactional records, spatial data, cache/queue, files and local offline state. |
| Integration | FHIR adapter; DHIS2/national systems subject to approval; SMS/USSD/IVR; mobile money; video/voice; maps; identity/credential sources. | Controlled external connectivity and translation between models. |

# 4\. Recommended technology baseline

| Area | Proposed technology | Rationale / caveat |
| --- | --- | --- |
| Web | Next.js + TypeScript | Patient web/PWA, clinician and administration interfaces; PWA offline scope limited to approved cached workflows. |
| Mobile | React Native + Expo; SQLite | Shared Android/iOS codebase; verify native background sync, encryption and device support early. |
| Backend | NestJS + TypeScript | Modular monolith, dependency injection, validation, OpenAPI and domain modules. |
| Primary database | PostgreSQL | Transactional consistency, mature relational model and security controls. |
| Geospatial | PostGIS | Facility discovery, catchments and routing integration. |
| Cache / jobs | Redis + durable job/outbox pattern | Cache and transient coordination; do not use cache as sole source of truth. |
| Local storage | Encrypted SQLite on mobile; IndexedDB on web | Offline records, queue and cached reference data; minimize sensitive local data. |
| AI services | Python + FastAPI, separately deployable | Isolate model lifecycle, evaluation and clinical safety controls. |
| Realtime | WebRTC via vetted provider or managed SFU | Audio/video; design fallback and operational support. |
| Files | S3-compatible object storage with encryption and malware scanning | Documents, reports and attachments; signed short-lived access. |
| Observability | OpenTelemetry + metrics/logs/traces platform | Monitoring, incident diagnosis and SLO reporting. |
| Deployment | Containerized services; managed PostgreSQL; CI/CD and infrastructure as code | Start with simple managed infrastructure; avoid premature Kubernetes unless justified. |

# 5\. Domain module boundaries

| Domain | Owns | Key interactions |
| --- | --- | --- |
| Identity & access | Users, roles, sessions, devices, MFA, consent references. | All modules; identity provider. |
| Patient | Demographics, identifiers, relationships, contact and preferences. | EHR, appointments, referrals, community health. |
| Provider & facility | Practitioners, credentials, organizations, locations, services and verification. | Scheduling, encounters, directory and administration. |
| Scheduling | Availability, appointment, booking state and reminders. | Patient, provider, notification. |
| Clinical record | Encounter, observation, condition, allergy, medication statement, care plan and documents. | Consultation, laboratory, pharmacy and referral. |
| Telehealth | Session lifecycle, channel metadata, secure messages and consultation workflow. | Scheduling, clinical record and realtime provider. |
| Referral | Referral request, destination, urgency, acceptance and outcome. | Clinical record, facility and notification. |
| Laboratory | Service catalogue, service request, specimen, diagnostic report and result release. | Clinical record and facility. |
| Pharmacy | Catalogue, stock snapshot, prescription validation and fulfilment. | Medication request, provider and patient. |
| Community health | Catchment, household, worker assignment, visit and approved observations. | Patient, referral, synchronization. |
| Billing | Price quote, invoice, payment intent, transaction, refund and reconciliation. | Payment gateway, appointments and finance. |
| Content/localization | Content assets, locale, translation, approval, version and expiry. | All clients and notifications. |
| Audit/reporting | Access events, change events, operational aggregates and authorized exports. | All modules; analytics warehouse later. |

# 6\. Data architecture and core entities

| Entity | Important attributes / relationships |
| --- | --- |
| UserAccount | Account ID, authentication identifiers, status, MFA state, created/updated timestamps. |
| Person / Patient | Person ID, patient identifiers, demographics, contact, language, consent references, linked account. |
| RelatedPerson | Relationship to patient, authority scope, validity dates and verification evidence. |
| Practitioner | Professional identity, registration number, specialty, verification status, expiry, affiliations. |
| Organization / Facility | Facility type, licensing evidence, contacts, service catalogue, operating hours, location. |
| DeviceRegistration | Device ID, user, platform, public key/device trust status, last sync, revocation state. |
| Appointment | Patient, practitioner/facility, time, status, channel, price quote, source and idempotency key. |
| Encounter | Patient, provider, facility, period, reason, status, notes and provenance. |
| ClinicalObservation | Code, value, unit, effective time, performer, source device and validation status. |
| Condition / Allergy | Clinical concept, onset/status, recorder, source and verification. |
| MedicationRequest / Dispense | Medication, dosage instruction, authorizing clinician, pharmacy, status and audit. |
| ServiceRequest / Specimen / DiagnosticReport | Order, specimen identifier, collection and processing status, result and validating professional. |
| Referral | Reason, urgency, destination, sender, acceptance, appointment and outcome. |
| Household / CommunityVisit | Catchment, household members, worker, visit time, approved observations and sync status. |
| Consent / Authorization | Subject, purpose, scope, recipient, legal basis, effective period and withdrawal. |
| SyncOperation | Operation ID, device, sequence, entity/version, idempotency key, state, error and acknowledgement. |
| AuditEvent | Actor, action, subject, purpose, timestamp, device, outcome and correlation ID. |
| PaymentTransaction | Amount, currency, provider reference, status, settlement, refund and reconciliation metadata. |

# 7\. Offline data and synchronization architecture

## 7.1 Client-side data classes

| Class | Examples | Offline policy |
| --- | --- | --- |
| Reference data | Provider/facility directory snapshot, service catalogue, clinical form definitions, language packs. | Cache with version and expiry; display last updated. |
| Patient-authorized data | Patient profile, selected history, current medications and previously issued documents. | Cache only on enrolled/trusted device with explicit scope, encryption and expiry. |
| New local transactions | Household visit, approved observations, registration request, appointment request. | Persist in encrypted queue; immutable operation ID; visible pending status. |
| High-risk/real-time data | Live availability, payment settlement, current pharmacy stock, emergency dispatch status. | Do not treat stale cache as current; require online confirmation or explicit stale warning. |

## 7.2 Synchronization protocol

-   Each local operation receives a globally unique operation ID, device ID, local sequence, schema version, created-at time and idempotency key.
-   Client submits batches over authenticated TLS connections; server validates device, user, role, scope, consent/legal basis and payload schema.
-   Server applies accepted operations transactionally and returns per-operation acknowledgements and canonical server identifiers.
-   Retries are safe: the same idempotency key returns the prior result rather than creating a duplicate.
-   Rejected operations include machine-readable reason codes and a safe remediation path.
-   Conflicts are resolved by entity-specific policy; clinical entries are append/version oriented, not last-write-wins.
-   Server time is authoritative for receipt/audit; client time is retained as source metadata and marked as device-reported.
-   Large attachments upload separately using resumable, short-lived upload credentials and integrity checks.
-   Sync engine uses backoff, network constraints, battery-aware scheduling and user-triggered retry.
-   Device revocation blocks future synchronization and triggers local data purge when the device next connects; lost-device risk is mitigated by short local retention and encryption.

## 7.3 Conflict policy

| Data type | Policy |
| --- | --- |
| Patient demographics | Field-level merge for non-sensitive fields; conflict queue for identity-critical changes. |
| Clinical observations | Append-only; corrections create amendment with author, reason and link to original. |
| Encounter notes | Versioned, attributed amendments; signed/finalized notes are not silently overwritten. |
| Appointments | Server-controlled booking state; offline request is a request, not a confirmed booking. |
| Pharmacy stock | Server/partner source is authoritative; offline stock is stale snapshot only. |
| Payments | Gateway-confirmed state is authoritative; client state cannot mark payment as settled. |
| Consent | Consent/withdrawal events are versioned and must be checked before subsequent processing. |

# 8\. Interoperability architecture

Use HL7 FHIR as a standards-aligned interoperability target, while maintaining a canonical internal domain model and adapters. Do not assume a particular FHIR release, national profile or terminology set is mandated until confirmed with MINSANTE and the relevant national governance body.

| Internal concept | FHIR mapping candidate |
| --- | --- |
| Patient | Patient |
| Practitioner | Practitioner / PractitionerRole |
| Facility | Organization / Location / HealthcareService |
| Appointment | Appointment |
| Consultation | Encounter |
| Clinical observation | Observation |
| Diagnosis / problem | Condition |
| Allergy | AllergyIntolerance |
| Prescription | MedicationRequest |
| Dispensing | MedicationDispense |
| Lab order | ServiceRequest |
| Lab result | DiagnosticReport / Observation / Specimen |
| Referral | ServiceRequest / CarePlan depending on workflow |
| Consent | Consent |
| Audit | AuditEvent |

-   Version API contracts and validate profiles with integration partners.
-   Use terminology services or governed code sets; avoid free-text-only critical clinical coding.
-   Maintain mapping/version metadata and data provenance.
-   Create an integration sandbox and conformance tests.
-   Only connect to national platforms under written authorization and approved technical/security specifications.

# 9\. Security and privacy architecture

## 9.1 Identity and authorization

-   Central identity provider or managed identity service with OIDC/OAuth 2.1-compatible flows.
-   MFA for clinicians, administrators and privileged users; risk-based step-up for sensitive actions.
-   RBAC supplemented by attributes: care relationship, facility, purpose, consent, geography and data sensitivity.
-   Short-lived access tokens, refresh-token rotation, secure storage and session revocation.
-   Separate platform operations roles from clinical roles.
-   Break-glass access only where justified, time-limited, reason-coded and audited.

## 9.2 Data protection controls

-   TLS for all network communications; modern cipher suites and certificate management.
-   Encryption at rest for databases, object storage, backups and local mobile databases; keys managed separately.
-   Field-level encryption/tokenization for selected high-risk identifiers where justified.
-   Secrets management; no secrets embedded in client applications or source control.
-   Audit log integrity and restricted access; security events monitored centrally.
-   Data minimization, purpose limitation, retention schedule and controlled deletion/anonymization.
-   Backup encryption, restore tests, recovery objectives and regional/cross-border transfer review.
-   Privacy impact assessment and data-flow register before pilot.

| Legal gate — Cameroon Law No. 2024/017 is a primary legal reference. Counsel must determine controller/processor roles, lawful bases, sensitive-data conditions, consent requirements, hosting/transfer controls, notification duties and any sector-specific authorization before production processing. |
| --- |

# 10\. AI architecture and safety

-   AI services are isolated behind a policy-enforcing API; clients never call model providers directly with identifiable health data.
-   Initial AI scope: navigation, education from approved content, consultation preparation and plain-language explanation of clinician-issued documents.
-   Exclude autonomous diagnosis, prescription generation, medication changes and emergency clearance.
-   Use approved, versioned knowledge sources; cite/identify source content within the user experience where appropriate.
-   Record model/version, prompt policy, retrieval sources, confidence/abstention state and safety escalation metadata.
-   Use human review for clinical-risk workflows; provide clinician override and kill switch.
-   Evaluate language performance separately for English, French, Fulfulde and Gbaya; do not assume translation quality or clinical equivalence.
-   Do not train models on patient data without a separately reviewed lawful basis, governance and appropriate consent where required.

# 11\. Integration architecture

| Integration | Approach | Key controls |
| --- | --- | --- |
| SMS / IVR / USSD | Adapter layer and provider abstraction; provider selected after coverage and commercial assessment. | Consent/preferences, message minimization, delivery status, short-code contracts, no sensitive detail in plain SMS. |
| Mobile Money | Payment intent and callback/webhook integration. | Signature verification, idempotency, reconciliation, refunds, no raw PIN/card storage. |
| Video/voice | WebRTC or vetted managed service. | Secure room tokens, access control, recording off by default, clinical consent and fallback. |
| Maps/geocoding | Approved map provider or open geospatial data. | Minimize location retention; consent for precise sharing; offline maps only where licensed. |
| National health platforms | FHIR/API adapter or approved integration mechanism. | Written authorization, national profiles, data-sharing agreement and conformance testing. |
| Laboratory/pharmacy partners | Partner API or secure portal with manual fallback. | Partner identity, data validation, stock/result freshness and audit. |

# 12\. Deployment and environment strategy

| Environment | Purpose | Controls |
| --- | --- | --- |
| Local development | Developer productivity. | Synthetic data only; no real patient data. |
| Integration/test | Automated and partner integration tests. | Masked/synthetic data; isolated credentials and endpoints. |
| Staging/UAT | Clinical workflow, security and user acceptance. | Production-like controls; approved test accounts; no uncontrolled live records. |
| Production | Live patient and provider services. | Strong access controls, monitored deployments, backups, incident response and change approval. |

-   Use CI/CD with code review, automated tests, dependency and container scanning, secret scanning and signed build artifacts.
-   Manage infrastructure using version-controlled infrastructure as code.
-   Use blue/green or canary deployment where practical; provide rollback and database migration strategy.
-   Separate production data and credentials from non-production environments.
-   Define RPO/RTO with hosting provider and validate through restore and failover exercises.

# 13\. Reliability, performance and service objectives

| Area | Proposed initial objective |
| --- | --- |
| Core service availability | 99.5% monthly target for core APIs during pilot, subject to hosting/SLA validation. |
| Mobile local read | ≤2 seconds p95 for defined pre-synchronized records on reference devices. |
| Local save | ≤3 seconds p95 for basic offline forms. |
| Sync recovery | Retry with backoff; no acknowledged local operation loss in test suite. |
| Data recovery | Initial proposed RPO ≤24 hours and RTO ≤8 hours; tighten after service criticality and hosting review. |
| API latency | Define endpoint-specific p95 targets after load testing; lightweight core endpoints prioritized. |
| Monitoring | Metrics, structured logs, distributed traces, audit events and alerting for critical failures. |

# 14\. Testing strategy

-   Unit tests for domain rules, authorization and validation.
-   Integration tests for database transactions, queues, payments and partner adapters.
-   Contract tests for APIs and FHIR mappings.
-   Offline fault-injection tests: airplane mode, intermittent network, duplicate delivery, app termination, clock drift, low battery and storage pressure.
-   Security tests: threat modelling, SAST/DAST, dependency scanning, penetration testing and access-control review.
-   Clinical safety tests: identity mismatch, allergy display, wrong-patient prevention, prescription attribution, urgent warning escalation and referral failure.
-   Accessibility and localization testing with target users and language reviewers.
-   Load and resilience tests based on expected pilot volumes and peak concurrency.
-   Disaster recovery and backup restoration exercises.

# 15\. Key technical risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Offline sync corruption or duplication | Idempotency keys, append-only clinical events, transactional acknowledgements and fault injection. |
| Stale cached information | Visible timestamps, freshness thresholds and online revalidation for time-sensitive decisions. |
| Lost or shared devices | Encrypted local store, device PIN/biometric, short retention, app lock, revocation and minimum cached data. |
| Unauthorized record access | Contextual authorization, MFA, audit, periodic access review and break-glass controls. |
| Unreliable external integrations | Adapters, retries, dead-letter queues, reconciliation and manual fallback. |
| Over-complex early infrastructure | Modular monolith and managed services; defer microservices and Kubernetes until justified. |
| AI unsafe or poor local-language output | Restricted scope, clinical review, evaluation, abstention and feature kill switch. |
| Vendor lock-in | FHIR-aligned exports, open API contracts, portable database and object storage formats. |

# 16\. Phased implementation plan

| Phase | Architecture and engineering deliverables | Exit gate |
| --- | --- | --- |
| A — Discovery and validation | Workflow mapping, legal/privacy assessment, field network/device survey, architecture decision records, clickable prototype and sync proof-of-concept. | Stakeholders validate workflows; high-risk assumptions documented. |
| B — Platform foundation | Identity, API, core database, patient/provider/facility modules, audit, CI/CD and initial web/mobile clients. | Security baseline and core API contracts pass. |
| C — Clinical MVP | Scheduling, encounters, basic EHR, teleconsultation, prescription/referral and clinician portal. | Clinical governance and end-to-end acceptance passed. |
| D — Offline field release | Encrypted SQLite, offline queue, sync service, conflict handling, community health worker workflows and field test. | Fault-injection and real-world connectivity tests passed. |
| E — Ecosystem integrations | Laboratory, pharmacy, SMS/USSD, payments, localization and partner adapters. | Partner agreements and integration conformance passed. |
| F — Intelligence and scale | AI navigation, device integrations, analytics and institutional interoperability. | Clinical AI governance, legal approval and scale-readiness passed. |

# 17\. Architecture decisions to record (ADRs)

| ADR | Decision to formalize | Status |
| --- | --- | --- |
| ADR-001 | Modular monolith vs microservices for initial release | Proposed: modular monolith |
| ADR-002 | Mobile local database and encryption implementation | To validate in prototype |
| ADR-003 | Offline conflict policy by entity | Proposed policies documented; clinical review required |
| ADR-004 | Cloud provider, hosting region and data sovereignty | Open; legal and procurement review |
| ADR-005 | Identity provider and MFA | Open; security assessment |
| ADR-006 | FHIR release and national profiles | Open; MINSANTE/partner alignment |
| ADR-007 | Video/voice provider and recording policy | Open; privacy and clinical review |
| ADR-008 | SMS/USSD/IVR aggregator and coverage | Open; regional field/commercial validation |
| ADR-009 | Payment providers and settlement model | Open; merchant due diligence |
| ADR-010 | AI model providers, data processing and evaluation | Open; governance gate |

# Reference sources and standards

-   MINSANTE, Cameroon National Digital Health Strategic Plan 2026–2030 (official publication): https://www.minsante.cm/site/sites/default/files/IF\_S%26E\_NDHSP%202026-2030\_En.pdf
-   MINSANTE, National Digital Health Strategic Plan 2026–2030 landing page: https://minsante.cm/site/?q=en%2Fcontent%2Fnational-digital-health-strategic-plan-2026-2030
-   Republic of Cameroon, Law No. 2024/017 of 23 December 2024 relating to personal data protection: https://www.prc.cm/en/news/the-acts/laws/7602
-   HL7 International, FHIR R5 specification: https://hl7.org/fhir/
-   HL7 International, FHIR Appointment resource: https://hl7.org/fhir/appointment.html
-   WHO, Global strategy on digital health 2020–2025 (reference framework): https://www.who.int/health-topics/digital-health
-   Note: Applicable professional licensing, telemedicine, pharmacy, laboratory, hosting, cross-border transfer and health-data requirements must be confirmed by Cameroonian legal and clinical advisors before live deployment.
