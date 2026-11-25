-- pgTAP: review fixes of Step 1.2 (migration 0014). Reuses the fixtures of 0004 and adds:
--   users …11 second caregiver of A · …12 CHW supervisor · …13 suspended caregiver of A
--   patient B gets a care relationship with the clinician (…04) and is then marked entered_in_error.
-- Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

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

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-100000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.caregiver.two@jorapha.test'),
  ('00000000-0000-4000-8000-100000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.chw.supervisor@jorapha.test'),
  ('00000000-0000-4000-8000-100000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.caregiver.suspended@jorapha.test');
insert into identity.person (id, user_account_id, family_name, given_names) values
  ('00000000-0000-4000-8000-200000000011', '00000000-0000-4000-8000-100000000011', 'Caregiver', 'Two'),
  ('00000000-0000-4000-8000-200000000013', '00000000-0000-4000-8000-100000000013', 'Caregiver', 'Suspended');
insert into patient.related_person (id, patient_id, person_id, relationship, authority_scope, verification_status, verified_by, verified_at) values
  ('00000000-0000-4000-8000-b00000000002', '00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-200000000011',
   'legal_guardian', array['view_record'], 'verified', '00000000-0000-4000-8000-100000000009', now()),
  ('00000000-0000-4000-8000-b00000000003', '00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-200000000013',
   'other', array['view_record'], 'verified', '00000000-0000-4000-8000-100000000009', now());
update identity.user_account set status = 'suspended', suspended_reason = 'test' where id = '00000000-0000-4000-8000-100000000013';
insert into identity.membership (user_account_id, role, organization_id, granted_by) values
  ('00000000-0000-4000-8000-100000000012', 'chw_supervisor', '00000000-0000-4000-8000-400000000001', '00000000-0000-4000-8000-100000000009');
insert into community.chw_assignment (id, user_account_id, catchment_id, supervisor_user_id) values
  ('00000000-0000-4000-8000-e00000000003', '00000000-0000-4000-8000-100000000007', '00000000-0000-4000-8000-e00000000001',
   '00000000-0000-4000-8000-100000000012');
insert into clinical.care_relationship (id, patient_id, practitioner_role_id, basis, valid_to) values
  ('00000000-0000-4000-8000-a00000000002', '00000000-0000-4000-8000-300000000002', '00000000-0000-4000-8000-800000000001',
   'facility_assignment', now() + interval '1 day');

-- ── Status and validity transitions (as postgres) ───────────────────────────────────────────────

select throws_ok($$update clinical.care_relationship set valid_to = now() + interval '3 days' where id = '00000000-0000-4000-8000-a00000000001'$$,
  '42501', null, 'a care relationship (and so a break-glass window) cannot be extended');
select throws_ok($$update identity.membership set role = 'platform_admin' where user_account_id = '00000000-0000-4000-8000-100000000004'$$,
  '42501', null, 'the role of a membership cannot be rewritten');
select throws_ok($$update identity.device_registration set app = 'chw' where id = '00000000-0000-4000-8000-0d0000000001'$$,
  '42501', null, 'the identity of a device cannot be rewritten');
select throws_ok($$update patient.patient set status = 'inactive' where id = '00000000-0000-4000-8000-300000000002'$$,
  '23514', null, 'a patient status change needs an author and a reason');
select throws_ok($$update patient.patient set status = 'merged', merged_into_id = id, status_changed_by = '00000000-0000-4000-8000-100000000009',
  status_reason = 'duplicate' where id = '00000000-0000-4000-8000-300000000002'$$, '23514', null, 'a patient cannot be merged into itself');
update patient.consent set status = 'superseded' where id = '00000000-0000-4000-8000-d00000000002';
select throws_ok($$update patient.consent set status = 'active' where id = '00000000-0000-4000-8000-d00000000002'$$,
  '42501', null, 'a superseded consent cannot be revived');
select throws_ok($$update clinical.care_relationship set status = 'ended' where id = '00000000-0000-4000-8000-a00000000002'$$,
  '23514', null, 'ending a care relationship needs who and why');

-- service_role must state created_by (attribution of sync-ingest writes)
select set_config('request.jwt.claims', '', true);
set local role service_role;
select throws_ok($$insert into identity.person (family_name, given_names) values ('No', 'Author')$$,
  '23502', null, 'service_role writes without created_by are refused');
select lives_ok($$insert into identity.person (family_name, given_names, created_by)
  values ('With', 'Author', '00000000-0000-4000-8000-100000000007')$$, 'service_role writes with created_by are accepted');
reset role;

-- Identity-critical demographic change is audited (names of fields, not values)
update identity.person set family_name = 'Patient-Renamed' where id = '00000000-0000-4000-8000-200000000001';
select ok(exists (select 1 from audit.audit_event where action = 'amend' and entity_id = '00000000-0000-4000-8000-200000000001'
  and reason like '%family_name%' and reason not like '%Renamed%'), 'identity-critical change is audited without the value');

-- Sync: server-side initial state is pending, never "received"
select is((select state from sync.operation where id = '00000000-0000-4000-8000-5a0000000001'), 'pending',
  'a new sync operation is pending until applied');

-- ── Caregivers ──────────────────────────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000011","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1, 'second caregiver reads the dependant');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000003'), 0,
  'a caregiver cannot read another caregiver''s person row');
select is((select count(*)::int from patient.related_person where id = '00000000-0000-4000-8000-b00000000001'), 0,
  'a caregiver cannot read another caregiver''s link');
select is((select count(*)::int from patient.related_person where id = '00000000-0000-4000-8000-b00000000002'), 1,
  'a caregiver reads their own link');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000013","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0,
  'a suspended caregiver loses access');
select is((select count(*)::int from identity.person where id = '00000000-0000-4000-8000-200000000013'), 0,
  'a suspended account cannot read even its own person row');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from patient.related_person where patient_id = '00000000-0000-4000-8000-300000000001'), 3,
  'the patient sees all of their caregiver links');
reset role;

-- ── CHW and supervisor ──────────────────────────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000012","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0,
  'a CHW supervisor without MFA cannot read patients');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000012","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 1,
  'a CHW supervisor with MFA reads patients in supervised catchments');
select throws_ok($$select api.record_consent('00000000-0000-4000-8000-d00000000020', '00000000-0000-4000-8000-300000000001',
  'sms_contact', 'v1', p_evidence_object_path => 'consent/tap.pdf')$$, '42501', null, 'a supervisor has no consent authority');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000007","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select api.record_consent('00000000-0000-4000-8000-d00000000021', '00000000-0000-4000-8000-300000000001',
  'sms_contact', 'v1')$$, '22023', null, 'a CHW must attach evidence to an assisted consent');
select lives_ok($$select api.record_consent('00000000-0000-4000-8000-d00000000022', '00000000-0000-4000-8000-300000000001',
  'sms_contact', 'v1', p_evidence_object_path => 'consent/tap-signed-form.pdf')$$, 'a CHW records an assisted consent with evidence');
select is((select count(*)::int from patient.consent where patient_id = '00000000-0000-4000-8000-300000000001'), 1,
  'a CHW reads only the consents they recorded');
select throws_ok($$select api.withdraw_consent('00000000-0000-4000-8000-d00000000001', '00000000-0000-4000-8000-d00000000023',
  'patient asked')$$, '42501', null, 'a CHW cannot withdraw a consent they did not capture');
select ok(not private.can_read_clinical('00000000-0000-4000-8000-300000000001'),
  'the clinical-record predicate excludes CHWs');
reset role;
select is((select grantor_kind from patient.consent where id = '00000000-0000-4000-8000-d00000000022'), 'assisted_chw',
  'an assisted consent is marked as such, not as given by the patient');

-- ── Clinicians: patient status, licence, organization ──────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000002'), 1,
  'clinician reads patient B while the care relationship is active');
select ok(private.can_read_clinical('00000000-0000-4000-8000-300000000001'), 'the clinical-record predicate includes the treating clinician');
reset role;

update patient.patient set status = 'entered_in_error', status_changed_by = '00000000-0000-4000-8000-100000000009',
  status_reason = 'registered twice by mistake' where id = '00000000-0000-4000-8000-300000000002';
update provider.credential set expires_on = current_date - 1 where id = '00000000-0000-4000-8000-900000000001';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000002'), 0,
  'an entered-in-error patient is hidden from clinicians');
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0,
  'a clinician with an expired licence loses access');
reset role;

update provider.credential set expires_on = null where id = '00000000-0000-4000-8000-900000000001';
update provider.organization set status = 'suspended' where id = '00000000-0000-4000-8000-400000000001';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000004","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select is((select count(*)::int from patient.patient where id = '00000000-0000-4000-8000-300000000001'), 0,
  'clinicians of a suspended organization lose access');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000005","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select throws_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000002',
  'unconscious patient brought to the centre, no relative present')$$, '42501', null,
  'break-glass is refused at a suspended organization');
reset role;
update provider.organization set status = 'active' where id = '00000000-0000-4000-8000-400000000001';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000005","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select lives_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000002',
  'unconscious patient brought to the centre, no relative present')$$, 'break-glass works at an active organization');
select throws_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000002',
  'unconscious patient brought to the centre, no relative present')$$, '22023', null,
  'break-glass cannot be re-issued while one is active');
select throws_ok($$select api.break_glass('00000000-0000-4000-8000-300000000001', '00000000-0000-4000-8000-800000000001',
  'trying to use another clinician''s role for access')$$, '42501', null, 'break-glass on another clinician''s role is refused');
reset role;
select ok(exists (select 1 from clinical.care_relationship where basis = 'break_glass' and reviewed_at is null),
  'break-glass rows wait in the review queue (reviewed_at is null)');

-- ── Directory, admins, API ownership checks ────────────────────────────────────────────────────

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select licence_evidence_path from provider.organization$$, '42501', null,
  'licence evidence is not readable through the directory');
select is((select count(*)::int from provider.location where id = '00000000-0000-4000-8000-500000000001'), 1, 'directory: listed location is visible');
select is((select count(*)::int from provider.practitioner where id = '00000000-0000-4000-8000-700000000001'), 1, 'directory: verified practitioner is visible');
select throws_ok($$select api.revoke_device('00000000-0000-4000-8000-0d0000000001', 'not mine')$$, '42501', null,
  'a user cannot revoke another account''s device');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000009","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from audit.audit_event), 0, 'platform admin without MFA reads no audit events');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000008","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from identity.membership where organization_id = '00000000-0000-4000-8000-400000000001'
  and user_account_id <> '00000000-0000-4000-8000-100000000008'), 0, 'facility admin without MFA reads no staff memberships');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-100000000008","role":"authenticated","aal":"aal2"}', true);
set local role authenticated;
select ok((select count(*)::int from identity.membership where organization_id = '00000000-0000-4000-8000-400000000001'
  and user_account_id <> '00000000-0000-4000-8000-100000000008') > 0, 'facility admin with MFA reads staff memberships');
select is((select count(*)::int from provider.credential where id = '00000000-0000-4000-8000-900000000001'), 1,
  'facility admin reads credentials of a current staff member');
select throws_ok($$select api.end_membership((select id from identity.membership where user_account_id = '00000000-0000-4000-8000-100000000008'
  and organization_id = '00000000-0000-4000-8000-400000000001'), 'leaving')$$, '42501', null, 'nobody ends their own membership');
reset role;

select * from finish();
rollback;
