-- pgTAP: foundation RLS, triggers and write API (migrations 0005–0013, Step 1.2).
-- For EVERY foundation table: the owner can read; an unrelated patient cannot; a clinician without a care
-- relationship cannot; platform_support cannot read clinical/patient rows; anon cannot read anything.
-- Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
--
-- Fixture ids (all synthetic):
--   users  …1000000000NN   01 patient A · 02 patient B (unrelated) · 03 caregiver of A · 04 clinician with care
--          relationship to A · 05 clinician without · 06 platform_support · 07 CHW (A's catchment) ·
--          08 facility_admin (org1, org2) · 09 platform_admin · 10 practitioner applicant (unverified)
--   person …20000000000N (N = user), patients …3000000000 01/02, orgs …4000000000 01 (verified) / 02 (unverified)
begin;

create extension if not exists pgtap with schema extensions;

select plan(169);

-- ── Fixtures (as postgres, no JWT) ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '', true);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-100000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.patient.a@jorapha.test'),
  ('00000000-0000-4000-8000-100000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.patient.b@jorapha.test'),
  ('00000000-0000-4000-8000-100000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.caregiver@jorapha.test'),
  ('00000000-0000-4000-8000-100000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.clinician@jorapha.test'),
  ('00000000-0000-4000-8000-100000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.clinician.unrelated@jorapha.test'),
  ('00000000-0000-4000-8000-100000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.support@jorapha.test'),
  ('00000000-0000-4000-8000-100000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.chw@jorapha.test'),
  ('00000000-0000-4000-8000-100000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.facility.admin@jorapha.test'),
  ('00000000-0000-4000-8000-100000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.platform.admin@jorapha.test'),
  ('00000000-0000-4000-8000-100000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.applicant@jorapha.test');

insert into provider.organization (id, kind, name, verification_status, verified_by, verified_at, status) values
  ('00000000-0000-4000-8000-400000000001', 'health_centre', 'TAP Health Centre', 'verified', '00000000-0000-4000-8000-100000000009', now(), 'active'),
  ('00000000-0000-4000-8000-400000000002', 'clinic', 'TAP Unverified Clinic', 'submitted', null, null, 'inactive');

insert into identity.membership (user_account_id, role, organization_id, granted_by) values
  ('00000000-0000-4000-8000-100000000004', 'clinician', '00000000-0000-4000-8000-400000000001', '00000000-0000-4000-8000-100000000009'),
  ('00000000-0000-4000-8000-100000000005', 'clinician', '00000000-0000-4000-8000-400000000001', '00000000-0000-4000-8000-100000000009'),
  ('00000000-0000-4000-8000-100000000006', 'platform_support', null, '00000000-0000-4000-8000-100000000009'),
  ('00000000-0000-4000-8000-100000000007', 'chw', '00000000-0000-4000-8000-400000000001', '00000000-0000-4000-8000-100000000009'),
  ('00000000-0000-4000-8000-100000000008', 'facility_admin', '00000000-0000-4000-8000-400000000001', '00000000-0000-4000-8000-100000000009'),
  ('00000000-0000-4000-8000-100000000008', 'facility_admin', '00000000-0000-4000-8000-400000000002', '00000000-0000-4000-8000-100000000009'),
  ('00000000-0000-4000-8000-100000000009', 'platform_admin', null, '00000000-0000-4000-8000-100000000009');

insert into identity.person (id, user_account_id, family_name, given_names, sex) values
  ('00000000-0000-4000-8000-200000000001', '00000000-0000-4000-8000-100000000001', 'Patient', 'A', 'female'),
  ('00000000-0000-4000-8000-200000000002', '00000000-0000-4000-8000-100000000002', 'Patient', 'B', 'male'),
  ('00000000-0000-4000-8000-200000000003', '00000000-0000-4000-8000-100000000003', 'Caregiver', 'C', 'female'),
  ('00000000-0000-4000-8000-200000000004', '00000000-0000-4000-8000-100000000004', 'Clinician', 'D', 'male'),
  ('00000000-0000-4000-8000-200000000005', '00000000-0000-4000-8000-100000000005', 'Clinician', 'E', 'female'),
  ('00000000-0000-4000-8000-200000000010', '00000000-0000-4000-8000-100000000010', 'Applicant', 'F', 'male');

insert into patient.patient (id, person_id) values
  ('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-200000000001'),
  ('00000000-0000-4000-8000-300000000002', '00000000-0000-4000-8000-200000000002');

insert into provider.location (id, organization_id, name) values
  ('00000000-0000-4000-8000-500000000001', '00000000-0000-4000-8000-400000000001', 'TAP Centre site'),
  ('00000000-0000-4000-8000-500000000002', '00000000-0000-4000-8000-400000000002', 'TAP Clinic site');

insert into provider.healthcare_service (id, organization_id, category) values
  ('00000000-0000-4000-8000-600000000001', '00000000-0000-4000-8000-400000000001', 'general_consultation'),
  ('00000000-0000-4000-8000-600000000002', '00000000-0000-4000-8000-400000000002', 'general_consultation');

insert into provider.practitioner (id, person_id, display_name, verification_status, status) values
  ('00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-200000000004', 'Dr D', 'verified', 'active'),
  ('00000000-0000-4000-8000-700000000002', '00000000-0000-4000-8000-200000000005', 'Dr E', 'verified', 'active'),
  ('00000000-0000-4000-8000-700000000003', '00000000-0000-4000-8000-200000000010', 'Applicant F', 'submitted', 'inactive');

insert into provider.credential (id, practitioner_id, kind, issuer) values
  ('00000000-0000-4000-8000-900000000001', '00000000-0000-4000-8000-700000000001', 'registration', 'TAP issuing body');

insert into provider.practitioner_role (id, practitioner_id, organization_id, role_code) values
  ('00000000-0000-4000-8000-800000000001', '00000000-0000-4000-8000-700000000001', '00000000-0000-4000-8000-400000000001', 'doctor'),
  ('00000000-0000-4000-8000-800000000002', '00000000-0000-4000-8000-700000000002', '00000000-0000-4000-8000-400000000001', 'doctor'),
  ('00000000-0000-4000-8000-800000000003', '00000000-0000-4000-8000-700000000003', '00000000-0000-4000-8000-400000000002', 'doctor');

insert into clinical.care_relationship (id, patient_id, practitioner_role_id, basis, valid_to) values
  ('00000000-0000-4000-8000-a00000000001', '00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000001',
   'facility_assignment', now() + interval '1 day');

insert into patient.related_person (id, patient_id, person_id, relationship, authority_scope, verification_status, verified_by, verified_at) values
  ('00000000-0000-4000-8000-b00000000001', '00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-200000000003',
   'parent', array['view_record', 'give_consent'], 'verified', '00000000-0000-4000-8000-100000000009', now());

insert into patient.patient_identifier (id, patient_id, system, value_masked, value_encrypted, value_hash) values
  ('00000000-0000-4000-8000-c00000000001', '00000000-0000-4000-8000-300000000001', 'jorapha_platform', '****0001',
   '\x01'::bytea, repeat('a', 64)),
  ('00000000-0000-4000-8000-c00000000002', '00000000-0000-4000-8000-300000000002', 'jorapha_platform', '****0002',
   null, null);

insert into patient.consent (id, patient_id, purpose, policy_text_version) values
  ('00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-300000000001', 'platform_care', 'v1'),
  ('00000000-0000-4000-8000-d00000000002', '00000000-0000-4000-8000-300000000002', 'platform_care', 'v1');

insert into community.catchment (id, organization_id, name) values
  ('00000000-0000-4000-8000-e00000000001', '00000000-0000-4000-8000-400000000001', 'TAP catchment');
insert into community.chw_assignment (id, user_account_id, catchment_id) values
  ('00000000-0000-4000-8000-e00000000002', '00000000-0000-4000-8000-100000000007', '00000000-0000-4000-8000-e00000000001');
insert into community.household (id, catchment_id, name_or_head) values
  ('00000000-0000-4000-8000-f00000000001', '00000000-0000-4000-8000-e00000000001', 'TAP household');
insert into community.household_member (id, household_id, patient_id) values
  ('00000000-0000-4000-8000-f00000000002', '00000000-0000-4000-8000-f00000000001', '00000000-0000-4000-8000-300000000001');

insert into identity.device_registration (id, user_account_id, app, platform) values
  ('00000000-0000-4000-8000-0d0000000001', '00000000-0000-4000-8000-100000000001', 'patient', 'android');

insert into audit.audit_event (action, entity_schema, entity_table, entity_id, patient_id) values
  ('read', 'patient', 'patient', '00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-300000000001'),
  ('read', 'patient', 'patient', '00000000-0000-4000-8000-300000000002', '00000000-0000-4000-8000-300000000002');

insert into sync.operation (id, device_id, user_account_id, idempotency_key, local_sequence, schema_version,
  entity_table, entity_id, op, payload_sha256) values
  ('00000000-0000-4000-8000-5a0000000001', '00000000-0000-4000-8000-0d0000000001', '00000000-0000-4000-8000-100000000001',
   'tap-op-00000001', 1, 1, 'patient.consent', '00000000-0000-4000-8000-d00000000001', 'insert', repeat('b', 64));
insert into sync.conflict (id, operation_id, entity_table, entity_id) values
  ('00000000-0000-4000-8000-5b0000000001', '00000000-0000-4000-8000-5a0000000001', 'patient.consent',
   '00000000-0000-4000-8000-d00000000001');

-- ── 1. Standard columns and append-only triggers (as postgres) ──────────────────────────────────

insert into identity.person (id, family_name, given_names, created_at, updated_at, row_version, client_created_at)
values ('00000000-0000-4000-8000-2000000000ff', 'Clock', 'Test', '2001-01-01', '2001-01-01', 99, '2001-01-01');
select is((select created_at from identity.person where id = '00000000-0000-4000-8000-2000000000ff'), now(),
  'created_at is server time even when the client sends another value');
select is((select client_created_at from identity.person where id = '00000000-0000-4000-8000-2000000000ff'),
  '2001-01-01'::timestamptz, 'client_created_at keeps the device-reported value');
select is((select row_version from identity.person where id = '00000000-0000-4000-8000-2000000000ff'), 1,
  'row_version starts at 1 whatever the client sends');
update identity.person set phone = '+237600000000' where id = '00000000-0000-4000-8000-2000000000ff';
select is((select row_version from identity.person where id = '00000000-0000-4000-8000-2000000000ff'), 2,
  'row_version increments on update');

insert into audit.audit_event (action, entity_schema, entity_table, occurred_at, client_created_at)
values ('login', 'identity', 'user_account', '2001-01-01', '2001-01-01');
select is((select occurred_at from audit.audit_event where action = 'login' and entity_table = 'user_account'
  order by created_at desc limit 1), now(), 'audit occurred_at is server time, never the device time');

select throws_ok($$update patient.consent set purpose = 'research' where id = '00000000-0000-4000-8000-d00000000001'$$,
  '42501', null, 'consent content cannot be changed (append-only)');
select throws_ok($$delete from patient.patient where id = '00000000-0000-4000-8000-300000000002'$$,
  '42501', null, 'patients are never deleted');
select throws_ok($$update audit.audit_event set reason = 'x' where patient_id = '00000000-0000-4000-8000-300000000001'$$,
  '42501', null, 'audit events cannot be changed');
select throws_ok($$update clinical.care_relationship set basis = 'appointment' where id = '00000000-0000-4000-8000-a00000000001'$$,
  '42501', null, 'care relationship basis cannot be changed');
select lives_ok($$update clinical.care_relationship set valid_to = now() + interval '12 hours' where id = '00000000-0000-4000-8000-a00000000001'$$,
  'care relationship validity can be shortened');

-- ── 2. Owners can read their rows ───────────────────────────────────────────────────────────────

-- Patient A (aal1)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from identity.user_account where id = '00000000-0000-4000-8000-100000000001'), 1, 'patient A reads own user_account');
select is((select count(*)::int from identity.device_registration where id = '00000000-0000-4000-8000-0d0000000001'), 1, 'patient A reads own device');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000001'), 1, 'patient A reads own person');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1, 'patient A reads own patient');
select is((select count(*)::int from patient.patient_identifier where id = '00000000-0000-4000-8000-c00000000001'), 1, 'patient A reads own identifier (masked columns)');
select is((select count(*)::int from patient.related_person where id = '00000000-0000-4000-8000-b00000000001'), 1, 'patient A reads own caregiver link');
select is((select count(*)::int from patient.consent where id = '00000000-0000-4000-8000-d00000000001'), 1, 'patient A reads own consent');
select is((select count(*)::int from clinical.care_relationship where id = '00000000-0000-4000-8000-a00000000001'), 1, 'patient A sees who can see them');
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f00000000001'), 1, 'patient A reads own household');
select is((select count(*)::int from community.household_member where id = '00000000-0000-4000-8000-f00000000002'), 1, 'patient A reads own household membership');
select is((select count(*)::int from audit.audit_event where patient_id = '00000000-0000-4000-8000-300000000001'), 1, 'patient A reads own access history');
select is((select count(*)::int from sync.operation where id = '00000000-0000-4000-8000-5a0000000001'), 1, 'patient A reads own sync operation');
select is((select count(*)::int from sync.conflict where id = '00000000-0000-4000-8000-5b0000000001'), 1, 'patient A reads own sync conflict state');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000003'), 1, 'patient A reads own caregiver''s person');
select throws_ok($$select value_encrypted from patient.patient_identifier$$, '42501', null, 'encrypted identifier value is never selectable');
select throws_ok($$select client_values_encrypted from sync.conflict$$, '42501', null, 'stored client values of a conflict are not selectable');
select throws_ok($$insert into identity.person (family_name, given_names) values ('X', 'Y')$$, '42501', null, 'clients cannot insert directly');
select throws_ok($$update patient.patient set status = 'inactive' where id = '00000000-0000-4000-8000-300000000001'$$, '42501', null, 'clients cannot update directly');
reset role;

-- Clinician with care relationship (aal2)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from identity.membership where user_account_id = '00000000-0000-4000-8000-100000000004'), 1, 'clinician reads own membership');
select is((select count(*)::int from provider.credential where id = '00000000-0000-4000-8000-900000000001'), 1, 'clinician reads own credential');
select is((select count(*)::int from clinical.care_relationship where id = '00000000-0000-4000-8000-a00000000001'), 1, 'clinician reads own care relationship');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1, 'clinician with care relationship reads the patient (MFA)');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000001'), 1, 'clinician with care relationship reads the patient''s person');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000002'), 0, 'clinician cannot read a patient outside the relationship');
reset role;

-- Same clinician without MFA
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000004","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0, 'clinician without MFA (aal1) cannot read clinical data');
reset role;

-- Caregiver of A (aal1)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1, 'verified caregiver reads the dependant');
select is((select count(*)::int from patient.patient_identifier where id = '00000000-0000-4000-8000-c00000000001'), 1, 'caregiver reads masked identifier');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000002'), 0, 'caregiver cannot read an unrelated patient');
reset role;

-- Practitioner applicant (unverified directory rows)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000010","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from provider.practitioner where id = '00000000-0000-4000-8000-700000000003'), 1, 'applicant reads own unverified practitioner');
select is((select count(*)::int from provider.practitioner_role where id = '00000000-0000-4000-8000-800000000003'), 1, 'applicant reads own practitioner role');
reset role;

-- Facility admin (aal2) of the unverified organization
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000008","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from provider.organization where id = '00000000-0000-4000-8000-400000000002'), 1, 'facility admin reads own unverified organization');
select is((select count(*)::int from provider.location where id = '00000000-0000-4000-8000-500000000002'), 1, 'facility admin reads own location');
select is((select count(*)::int from provider.healthcare_service where id = '00000000-0000-4000-8000-600000000002'), 1, 'facility admin reads own service');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0, 'facility admin reads no patient data');
reset role;

-- CHW of A's catchment (aal1)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000007","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from community.catchment where id = '00000000-0000-4000-8000-e00000000001'), 1, 'CHW reads assigned catchment');
select is((select count(*)::int from community.chw_assignment where id = '00000000-0000-4000-8000-e00000000002'), 1, 'CHW reads own assignment');
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f00000000001'), 1, 'CHW reads household in catchment');
select is((select count(*)::int from community.household_member where id = '00000000-0000-4000-8000-f00000000002'), 1, 'CHW reads household member in catchment');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1, 'CHW reads patient in catchment');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000002'), 0, 'CHW cannot read a patient outside the catchment');
reset role;

-- Platform admin (aal2)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000009","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from audit.audit_event where patient_id = '00000000-0000-4000-8000-300000000001'), 1, 'platform admin (MFA) reads the audit trail');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0, 'platform admin reads no patient data by default');
reset role;

-- ── 3. Unrelated patient B cannot read any of A's or anyone else's rows (22 tables) ─────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from identity.user_account where id = '00000000-0000-4000-8000-100000000001'), 0, 'unrelated patient: user_account');
select is((select count(*)::int from identity.membership where user_account_id = '00000000-0000-4000-8000-100000000004'), 0, 'unrelated patient: membership');
select is((select count(*)::int from identity.device_registration where id = '00000000-0000-4000-8000-0d0000000001'), 0, 'unrelated patient: device_registration');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000001'), 0, 'unrelated patient: person');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0, 'unrelated patient: patient');
select is((select count(*)::int from patient.patient_identifier where id = '00000000-0000-4000-8000-c00000000001'), 0, 'unrelated patient: patient_identifier');
select is((select count(*)::int from patient.related_person where id = '00000000-0000-4000-8000-b00000000001'), 0, 'unrelated patient: related_person');
select is((select count(*)::int from patient.consent where id = '00000000-0000-4000-8000-d00000000001'), 0, 'unrelated patient: consent');
select is((select count(*)::int from provider.organization where id = '00000000-0000-4000-8000-400000000002'), 0, 'unrelated patient: unverified organization');
select is((select count(*)::int from provider.location where id = '00000000-0000-4000-8000-500000000002'), 0, 'unrelated patient: location of unlisted organization');
select is((select count(*)::int from provider.healthcare_service where id = '00000000-0000-4000-8000-600000000002'), 0, 'unrelated patient: service of unlisted organization');
select is((select count(*)::int from provider.practitioner where id = '00000000-0000-4000-8000-700000000003'), 0, 'unrelated patient: unverified practitioner');
select is((select count(*)::int from provider.credential where id = '00000000-0000-4000-8000-900000000001'), 0, 'unrelated patient: credential');
select is((select count(*)::int from provider.practitioner_role where id = '00000000-0000-4000-8000-800000000003'), 0, 'unrelated patient: unlisted practitioner_role');
select is((select count(*)::int from clinical.care_relationship where id = '00000000-0000-4000-8000-a00000000001'), 0, 'unrelated patient: care_relationship');
select is((select count(*)::int from community.catchment where id = '00000000-0000-4000-8000-e00000000001'), 0, 'unrelated patient: catchment');
select is((select count(*)::int from community.chw_assignment where id = '00000000-0000-4000-8000-e00000000002'), 0, 'unrelated patient: chw_assignment');
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f00000000001'), 0, 'unrelated patient: household');
select is((select count(*)::int from community.household_member where id = '00000000-0000-4000-8000-f00000000002'), 0, 'unrelated patient: household_member');
select is((select count(*)::int from audit.audit_event where patient_id = '00000000-0000-4000-8000-300000000001'), 0, 'unrelated patient: audit_event');
select is((select count(*)::int from sync.operation where id = '00000000-0000-4000-8000-5a0000000001'), 0, 'unrelated patient: sync.operation');
select is((select count(*)::int from sync.conflict where id = '00000000-0000-4000-8000-5b0000000001'), 0, 'unrelated patient: sync.conflict');
select is((select count(*)::int from provider.organization where id = '00000000-0000-4000-8000-400000000001'), 1, 'directory: a verified, active organization is visible to any signed-in user');
reset role;

-- ── 4. Clinician without a care relationship (aal2) cannot read (22 tables) ─────────────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000005","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from identity.user_account where id = '00000000-0000-4000-8000-100000000001'), 0, 'unrelated clinician: user_account');
select is((select count(*)::int from identity.membership where user_account_id = '00000000-0000-4000-8000-100000000004'), 0, 'unrelated clinician: membership');
select is((select count(*)::int from identity.device_registration where id = '00000000-0000-4000-8000-0d0000000001'), 0, 'unrelated clinician: device_registration');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000001'), 0, 'unrelated clinician: person');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0, 'unrelated clinician: patient');
select is((select count(*)::int from patient.patient_identifier where id = '00000000-0000-4000-8000-c00000000001'), 0, 'unrelated clinician: patient_identifier');
select is((select count(*)::int from patient.related_person where id = '00000000-0000-4000-8000-b00000000001'), 0, 'unrelated clinician: related_person');
select is((select count(*)::int from patient.consent where id = '00000000-0000-4000-8000-d00000000001'), 0, 'unrelated clinician: consent');
select is((select count(*)::int from provider.organization where id = '00000000-0000-4000-8000-400000000002'), 0, 'unrelated clinician: unverified organization');
select is((select count(*)::int from provider.location where id = '00000000-0000-4000-8000-500000000002'), 0, 'unrelated clinician: unlisted location');
select is((select count(*)::int from provider.healthcare_service where id = '00000000-0000-4000-8000-600000000002'), 0, 'unrelated clinician: unlisted service');
select is((select count(*)::int from provider.practitioner where id = '00000000-0000-4000-8000-700000000003'), 0, 'unrelated clinician: unverified practitioner');
select is((select count(*)::int from provider.credential where id = '00000000-0000-4000-8000-900000000001'), 0, 'unrelated clinician: another clinician''s credential');
select is((select count(*)::int from provider.practitioner_role where id = '00000000-0000-4000-8000-800000000003'), 0, 'unrelated clinician: unlisted practitioner_role');
select is((select count(*)::int from clinical.care_relationship where id = '00000000-0000-4000-8000-a00000000001'), 0, 'unrelated clinician: care_relationship');
select is((select count(*)::int from community.catchment where id = '00000000-0000-4000-8000-e00000000001'), 0, 'unrelated clinician: catchment');
select is((select count(*)::int from community.chw_assignment where id = '00000000-0000-4000-8000-e00000000002'), 0, 'unrelated clinician: chw_assignment');
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f00000000001'), 0, 'unrelated clinician: household');
select is((select count(*)::int from community.household_member where id = '00000000-0000-4000-8000-f00000000002'), 0, 'unrelated clinician: household_member');
select is((select count(*)::int from audit.audit_event where patient_id = '00000000-0000-4000-8000-300000000001'), 0, 'unrelated clinician: audit_event');
select is((select count(*)::int from sync.operation where id = '00000000-0000-4000-8000-5a0000000001'), 0, 'unrelated clinician: sync.operation');
select is((select count(*)::int from sync.conflict where id = '00000000-0000-4000-8000-5b0000000001'), 0, 'unrelated clinician: sync.conflict');
reset role;

-- ── 5. platform_support (aal2) cannot read clinical / patient rows ──────────────────────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000006","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from identity.user_account where id = '00000000-0000-4000-8000-100000000001'), 0, 'support: user_account');
select is((select count(*)::int from identity.membership where user_account_id = '00000000-0000-4000-8000-100000000004'), 0, 'support: membership');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000001'), 0, 'support: person');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0, 'support: patient');
select is((select count(*)::int from patient.patient_identifier where id = '00000000-0000-4000-8000-c00000000001'), 0, 'support: patient_identifier');
select is((select count(*)::int from patient.related_person where id = '00000000-0000-4000-8000-b00000000001'), 0, 'support: related_person');
select is((select count(*)::int from patient.consent where id = '00000000-0000-4000-8000-d00000000001'), 0, 'support: consent');
select is((select count(*)::int from provider.organization where id = '00000000-0000-4000-8000-400000000002'), 0, 'support: unverified organization');
select is((select count(*)::int from provider.location where id = '00000000-0000-4000-8000-500000000002'), 0, 'support: unlisted location');
select is((select count(*)::int from provider.healthcare_service where id = '00000000-0000-4000-8000-600000000002'), 0, 'support: unlisted service');
select is((select count(*)::int from provider.practitioner where id = '00000000-0000-4000-8000-700000000003'), 0, 'support: unverified practitioner');
select is((select count(*)::int from provider.credential where id = '00000000-0000-4000-8000-900000000001'), 0, 'support: credential');
select is((select count(*)::int from provider.practitioner_role where id = '00000000-0000-4000-8000-800000000003'), 0, 'support: unlisted practitioner_role');
select is((select count(*)::int from clinical.care_relationship where id = '00000000-0000-4000-8000-a00000000001'), 0, 'support: care_relationship');
select is((select count(*)::int from community.catchment where id = '00000000-0000-4000-8000-e00000000001'), 0, 'support: catchment');
select is((select count(*)::int from community.chw_assignment where id = '00000000-0000-4000-8000-e00000000002'), 0, 'support: chw_assignment');
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f00000000001'), 0, 'support: household');
select is((select count(*)::int from community.household_member where id = '00000000-0000-4000-8000-f00000000002'), 0, 'support: household_member');
select is((select count(*)::int from audit.audit_event where patient_id = '00000000-0000-4000-8000-300000000001'), 0, 'support: audit_event');
select is((select count(*)::int from sync.operation where id = '00000000-0000-4000-8000-5a0000000001'), 0, 'support: sync.operation');
select is((select count(*)::int from sync.conflict where id = '00000000-0000-4000-8000-5b0000000001'), 0, 'support: sync.conflict');
select is((select count(*)::int from identity.device_registration where id = '00000000-0000-4000-8000-0d0000000001'), 1, 'support (MFA) CAN read device metadata to help users (not clinical)');
reset role;

-- ── 6. Anonymous cannot read anything (22 tables) ───────────────────────────────────────────────

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$select 1 from identity.user_account$$, '42501', null, 'anon: user_account');
select throws_ok($$select 1 from identity.membership$$, '42501', null, 'anon: membership');
select throws_ok($$select 1 from identity.device_registration$$, '42501', null, 'anon: device_registration');
select throws_ok($$select 1 from identity.person$$, '42501', null, 'anon: person');
select throws_ok($$select 1 from patient.patient$$, '42501', null, 'anon: patient');
select throws_ok($$select 1 from patient.patient_identifier$$, '42501', null, 'anon: patient_identifier');
select throws_ok($$select 1 from patient.related_person$$, '42501', null, 'anon: related_person');
select throws_ok($$select 1 from patient.consent$$, '42501', null, 'anon: consent');
select throws_ok($$select 1 from provider.organization$$, '42501', null, 'anon: organization');
select throws_ok($$select 1 from provider.location$$, '42501', null, 'anon: location');
select throws_ok($$select 1 from provider.healthcare_service$$, '42501', null, 'anon: healthcare_service');
select throws_ok($$select 1 from provider.practitioner$$, '42501', null, 'anon: practitioner');
select throws_ok($$select 1 from provider.credential$$, '42501', null, 'anon: credential');
select throws_ok($$select 1 from provider.practitioner_role$$, '42501', null, 'anon: practitioner_role');
select throws_ok($$select 1 from clinical.care_relationship$$, '42501', null, 'anon: care_relationship');
select throws_ok($$select 1 from community.catchment$$, '42501', null, 'anon: catchment');
select throws_ok($$select 1 from community.chw_assignment$$, '42501', null, 'anon: chw_assignment');
select throws_ok($$select 1 from community.household$$, '42501', null, 'anon: household');
select throws_ok($$select 1 from community.household_member$$, '42501', null, 'anon: household_member');
select throws_ok($$select 1 from audit.audit_event$$, '42501', null, 'anon: audit_event');
select throws_ok($$select 1 from sync.operation$$, '42501', null, 'anon: sync.operation');
select throws_ok($$select 1 from sync.conflict$$, '42501', null, 'anon: sync.conflict');
select throws_ok($$select api.register_device('00000000-0000-4000-8000-0d00000000ff', 'patient', 'android')$$, '42501', null, 'anon: cannot call the write API');
reset role;

-- ── 7. Write API ────────────────────────────────────────────────────────────────────────────────

-- Devices
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is(api.register_device('00000000-0000-4000-8000-0d0000000002', 'patient', 'android', '1.0.0'),
  '00000000-0000-4000-8000-0d0000000002'::uuid, 'patient registers a device');
select is(api.register_device('00000000-0000-4000-8000-0d0000000002', 'patient', 'android', '1.0.0'),
  '00000000-0000-4000-8000-0d0000000002'::uuid, 'registering the same device again is idempotent');
select lives_ok($$select api.record_consent('00000000-0000-4000-8000-d00000000010', '00000000-0000-4000-8000-300000000001',
  'sms_contact', 'v1')$$, 'patient records own consent');
select lives_ok($$select api.record_consent('00000000-0000-4000-8000-d00000000011', '00000000-0000-4000-8000-300000000001',
  'platform_care', 'v2')$$, 'a new consent for the same purpose supersedes the previous one');
select lives_ok($$select api.revoke_device('00000000-0000-4000-8000-0d0000000002', 'lost phone')$$, 'patient revokes own device');
reset role;

select is((select status from patient.consent where id = '00000000-0000-4000-8000-d00000000001'), 'superseded',
  'the previous consent is marked superseded, not changed');
select is((select supersedes_id from patient.consent where id = '00000000-0000-4000-8000-d00000000011'),
  '00000000-0000-4000-8000-d00000000001'::uuid, 'the new consent links to the version it supersedes');
select is((select trust_status from identity.device_registration where id = '00000000-0000-4000-8000-0d0000000002'), 'revoked',
  'revoked device is marked revoked');
select ok(exists (select 1 from audit.audit_event where entity_id = '00000000-0000-4000-8000-0d0000000002' and action = 'revoke'),
  'device revocation is audited');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select api.register_device('00000000-0000-4000-8000-0d0000000001', 'patient', 'android')$$,
  '42501', null, 'a device id of another account cannot be claimed');
select throws_ok($$select api.record_consent('00000000-0000-4000-8000-d00000000012', '00000000-0000-4000-8000-300000000001',
  'research', 'v1')$$, '42501', null, 'an unrelated patient cannot record consent for patient A');
reset role;

-- Caregiver withdraws as grantor
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000003","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select lives_ok($$select api.withdraw_consent('00000000-0000-4000-8000-d00000000010', '00000000-0000-4000-8000-d00000000013',
  'changed mind', '00000000-0000-4000-8000-b00000000001')$$, 'verified caregiver with give_consent withdraws a consent');
reset role;
select is((select status from patient.consent where id = '00000000-0000-4000-8000-d00000000013'), 'withdrawn',
  'withdrawal is a new version with status withdrawn');

-- Break-glass
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000005","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000002',
  'unconscious patient brought to the centre, no relative present')$$, '42501', null, 'break-glass requires MFA');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000005","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000002', 'short')$$,
  '22023', null, 'break-glass requires a real reason');
select lives_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000002',
  'unconscious patient brought to the centre, no relative present')$$, 'clinician with MFA can break glass with a reason');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1,
  'after break-glass the clinician can read the patient');
reset role;
select ok(exists (select 1 from audit.audit_event where action = 'break_glass' and patient_id = '00000000-0000-4000-8000-300000000001'),
  'break-glass is audited');
select ok((select valid_to <= now() + interval '2 hours' from clinical.care_relationship
  where basis = 'break_glass' and patient_id = '00000000-0000-4000-8000-300000000001'), 'break-glass access is time-limited');

-- Memberships
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000008","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select api.grant_membership('00000000-0000-4000-8000-100000000010', 'clinician', '00000000-0000-4000-8000-400000000001')$$,
  'facility admin grants a staff role in own organization');
select throws_ok($$select api.grant_membership('00000000-0000-4000-8000-100000000010', 'platform_admin')$$,
  '42501', null, 'facility admin cannot grant a platform role');
select throws_ok($$select api.grant_membership('00000000-0000-4000-8000-100000000008', 'clinician', '00000000-0000-4000-8000-400000000001')$$,
  '42501', null, 'nobody grants themselves a role');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000008","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select api.grant_membership('00000000-0000-4000-8000-100000000002', 'clinician', '00000000-0000-4000-8000-400000000001')$$,
  '42501', null, 'admin actions require MFA');
reset role;

-- Access-token hook
select ok(
  (identity.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-4000-8000-100000000007', 'claims', '{}'::jsonb))
    -> 'claims' -> 'app_roles') ? 'chw',
  'the access-token hook adds active roles');
select ok(
  (identity.custom_access_token_hook(jsonb_build_object('user_id', '00000000-0000-4000-8000-100000000007', 'claims', '{}'::jsonb))
    -> 'claims' -> 'app_org_ids') ? '00000000-0000-4000-8000-400000000001',
  'the access-token hook adds organization ids');

-- Revocation is immediate: ending the clinician's membership removes access in the same session.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000009","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select api.end_membership((select id from identity.membership
  where user_account_id = '00000000-0000-4000-8000-100000000004' and role = 'clinician'), 'left the centre')$$,
  'platform admin ends a membership');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0,
  'a clinician whose membership ended loses access immediately (no wait for token expiry)');
reset role;

select * from finish();
rollback;
