---
status: Open
date: 2026-11-25
deciders: Project owner, after MINSANTE and partner alignment
consulted: Clinical informatics, integration partners
informed: Engineering
---

# ADR-006: FHIR release and national profiles

## Context and problem statement

TA §8 makes HL7 FHIR the interoperability target while keeping a canonical internal model with adapters
(`packages/fhir`). It states explicitly: _do not assume a particular FHIR release, national profile or
terminology set is mandated until confirmed with MINSANTE and the relevant national governance body_.
Connections to national platforms (e.g. DHIS2) require written authorization (TA §8, §11).
Which FHIR release, profiles and code systems do we target?

## Facts recorded so far

- The source documents reference the FHIR R5 specification (TA references) as a reference, not as a mandate.
- TA §8 lists candidate resource mappings (Patient, Practitioner/PractitionerRole, Organization/Location/
  HealthcareService, Appointment, Encounter, Observation, Condition, AllergyIntolerance, MedicationRequest,
  MedicationDispense, ServiceRequest, DiagnosticReport, Specimen, Consent, AuditEvent).
- The Concept Note records that MINSANTE has identified interconnection of electronic medical records,
  DHIS2, UHC systems and other national platforms as a priority.

## Open questions that must be answered

To MINSANTE / national digital-health governance body:

1. Is there a mandated or recommended FHIR release (R4, R4B, R5) for Cameroon?
2. Are there national FHIR profiles or implementation guides? Where are they published and versioned?
3. Which terminologies/code systems are required (diagnoses, laboratory, medicines, facility and
   practitioner identifiers)?
4. What process authorizes a private platform to exchange data with national systems (DHIS2, others),
   and what technical/security specification applies?
5. Is there a national patient identifier or master patient index we must use or link to?

To partners (laboratories, pharmacies, facilities):

6. Which formats and FHIR versions do partner systems actually support today?

## Decision outcome

**Open.** Until decided: keep the internal model canonical; `packages/fhir` maps to FHIR resources with the
release isolated as a single configuration point; no production exchange with national systems.

### Consequences

Interoperability work in Phase 5+ that depends on profiles is blocked; internal modelling is not.

### Confirmation

Written answer from MINSANTE/governance body referenced here; conformance tests against the chosen profiles
in an integration sandbox (TA §8).

## More information

TA §8, §11, §17; Concept Note (national interoperability priority); <https://hl7.org/fhir/>.
