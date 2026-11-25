-- 0008_patient: patients, identifiers, caregivers (related persons), consent; patient-visibility predicates.
-- Design: docs/design/erd.md §3 (patient.*) and §4 (where visibility is decided). Step 1.2.

create table if not exists patient.patient (
  id uuid primary key default gen_random_uuid(), -- client-generated when registered offline
  person_id uuid not null unique references identity.person (id),
  registered_at_organization_id uuid references provider.organization (id),
  registration_channel text not null default 'self'
    check (registration_channel in ('self', 'assisted_chw', 'facility')),
  assisted_by_user_id uuid references identity.user_account (id),
  assistance_authorization_basis text check (char_length(assistance_authorization_basis) <= 300),
  status text not null default 'active' check (status in ('active', 'inactive', 'merged', 'entered_in_error')),
  merged_into_id uuid references patient.patient (id),
  deceased_at timestamptz,
  origin_device_id uuid references identity.device_registration (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint patient_merge_consistent check ((status = 'merged') = (merged_into_id is not null)),
  constraint patient_assisted_recorded check (
    registration_channel <> 'assisted_chw' or (assisted_by_user_id is not null and assistance_authorization_basis is not null))
);

create table if not exists patient.patient_identifier (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient.patient (id),
  system text not null check (char_length(system) between 2 and 100), -- governed code list (ADR-006 Q5)
  value_encrypted bytea,   -- high-risk identifiers, encrypted with a Supabase Vault key; never selectable by clients
  value_masked text check (char_length(value_masked) <= 50),
  value_hash text check (value_hash ~ '^[0-9a-f]{64}$'), -- keyed hash for exact match / duplicate detection
  assigner_organization_id uuid references provider.organization (id),
  period_start date,
  period_end date,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected')),
  verified_by uuid references identity.user_account (id),
  verified_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'entered_in_error')),
  origin_device_id uuid references identity.device_registration (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint identifier_has_value check (value_encrypted is not null or value_masked is not null)
);
create index if not exists patient_identifier_patient_idx on patient.patient_identifier (patient_id);
create unique index if not exists patient_identifier_unique_active
  on patient.patient_identifier (system, value_hash) where status = 'active' and value_hash is not null;

create table if not exists patient.related_person (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient.patient (id),
  person_id uuid not null references identity.person (id),
  relationship text not null
    check (relationship in ('parent', 'legal_guardian', 'spouse', 'child', 'sibling', 'other')),
  authority_scope text[] not null default '{}' check (authority_scope <@ array[
    'view_record', 'view_results', 'book_appointments', 'manage_profile', 'give_consent', 'receive_notifications'
  ]::text[]),
  legal_basis text check (char_length(legal_basis) <= 100), -- code list pending counsel (ADR-004)
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'expired', 'revoked')),
  verification_method text check (char_length(verification_method) <= 100),
  verified_by uuid references identity.user_account (id),
  verified_at timestamptz,
  evidence_object_path text check (char_length(evidence_object_path) <= 500),
  revoked_at timestamptz,
  revoked_by uuid references identity.user_account (id),
  revocation_reason text check (char_length(revocation_reason) <= 500),
  origin_device_id uuid references identity.device_registration (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint related_person_validity check (valid_to is null or valid_to >= valid_from),
  constraint related_person_verified_recorded check (
    verification_status <> 'verified' or (verified_by is not null and verified_at is not null))
);
create index if not exists related_person_patient_idx on patient.related_person (patient_id);
create index if not exists related_person_person_idx on patient.related_person (person_id);

create table if not exists patient.consent (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient.patient (id),
  grantor_kind text not null default 'patient' check (grantor_kind in ('patient', 'related_person')),
  grantor_related_person_id uuid references patient.related_person (id),
  purpose text not null check (char_length(purpose) between 2 and 100),
  scope_categories text[] not null default '{}',
  recipient_organization_id uuid references provider.organization (id),
  recipient_practitioner_role_id uuid references provider.practitioner_role (id),
  legal_basis text check (char_length(legal_basis) <= 100),
  status text not null default 'active' check (status in ('active', 'withdrawn', 'superseded', 'entered_in_error')),
  period_start timestamptz not null default now(),
  period_end timestamptz,
  supersedes_id uuid unique references patient.consent (id),
  policy_text_version text not null check (char_length(policy_text_version) between 1 and 50),
  locale text not null default 'fr' check (char_length(locale) <= 16),
  recorded_by uuid references identity.user_account (id),
  evidence_object_path text check (char_length(evidence_object_path) <= 500),
  origin_device_id uuid references identity.device_registration (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint consent_grantor_consistent check (
    (grantor_kind = 'related_person') = (grantor_related_person_id is not null)),
  constraint consent_period check (period_end is null or period_end > period_start)
);
create index if not exists consent_patient_idx on patient.consent (patient_id);
create unique index if not exists consent_one_active
  on patient.consent (patient_id, purpose,
    coalesce(recipient_organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(recipient_practitioner_role_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';

-- Standard triggers; append-only guards (only the listed columns may change after insert).
select private.add_row_triggers('patient.patient', array['status', 'merged_into_id', 'deceased_at']);
select private.add_row_triggers('patient.patient_identifier',
  array['status', 'verification_status', 'verified_by', 'verified_at', 'period_end']);
select private.add_row_triggers('patient.related_person', array[
  'valid_to', 'verification_status', 'verification_method', 'verified_by', 'verified_at',
  'evidence_object_path', 'revoked_at', 'revoked_by', 'revocation_reason']);
select private.add_row_triggers('patient.consent', array['status']);

alter table patient.patient enable row level security;
alter table patient.patient force row level security;
alter table patient.patient_identifier enable row level security;
alter table patient.patient_identifier force row level security;
alter table patient.related_person enable row level security;
alter table patient.related_person force row level security;
alter table patient.consent enable row level security;
alter table patient.consent force row level security;

-- ── Visibility predicates (erd.md §4) ───────────────────────────────────────────────────────────
-- plpgsql so they can reference clinical/community tables created by later migrations.

create or replace function private.is_self_patient(p_patient_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from patient.patient as pa
    join identity.person as pe on pe.id = pa.person_id
    where pa.id = p_patient_id and pa.status = 'active' and pe.user_account_id = auth.uid()
  );
end;
$$;

create or replace function private.is_caregiver_of(p_patient_id uuid, p_scope text default 'view_record')
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from patient.related_person as rp
    join identity.person as pe on pe.id = rp.person_id
    join patient.patient as pa on pa.id = rp.patient_id
    where rp.patient_id = p_patient_id
      and pa.status = 'active'
      and pe.user_account_id = auth.uid()
      and rp.verification_status = 'verified'
      and rp.valid_from <= now()
      and (rp.valid_to is null or rp.valid_to > now())
      and p_scope = any (rp.authority_scope)
  );
end;
$$;

-- Clinician: MFA + active clinician membership in the role's organization + active practitioner role
-- + active, unexpired care relationship (RULE-01, PRD §5).
create or replace function private.has_care_relationship(p_patient_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not identity.aal2() then
    return false;
  end if;
  return exists (
    select 1
    from clinical.care_relationship as cr
    join provider.practitioner_role as r on r.id = cr.practitioner_role_id
    join provider.practitioner as pr on pr.id = r.practitioner_id
    join identity.person as pe on pe.id = pr.person_id
    where cr.patient_id = p_patient_id
      and pe.user_account_id = auth.uid()
      and cr.status = 'active' and cr.valid_from <= now() and cr.valid_to > now()
      and r.status = 'active' and r.valid_from <= now() and (r.valid_to is null or r.valid_to > now())
      and pr.status = 'active'
      and identity.has_role('clinician', r.organization_id)
  );
end;
$$;

-- CHW: active assignment to the catchment of the patient's current household (or supervisor of that assignment).
create or replace function private.in_chw_catchment(p_patient_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from community.household_member as hm
    join community.household as h on h.id = hm.household_id
    join community.catchment as c on c.id = h.catchment_id
    join community.chw_assignment as a on a.catchment_id = c.id
    where hm.patient_id = p_patient_id
      and hm.valid_from <= now() and (hm.valid_to is null or hm.valid_to > now())
      and h.status = 'active' and c.status = 'active'
      and a.status = 'active' and a.valid_from <= now() and (a.valid_to is null or a.valid_to > now())
      and (
        (a.user_account_id = auth.uid() and identity.has_role('chw', c.organization_id))
        or (a.supervisor_user_id = auth.uid() and identity.has_role('chw_supervisor', c.organization_id))
      )
  );
end;
$$;

create or replace function private.can_read_patient(p_patient_id uuid, p_scope text default 'view_record')
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.is_self_patient(p_patient_id)
    or private.is_caregiver_of(p_patient_id, p_scope)
    or private.has_care_relationship(p_patient_id)
    or private.in_chw_catchment(p_patient_id);
end;
$$;

revoke execute on function private.is_self_patient(uuid), private.is_caregiver_of(uuid, text),
  private.has_care_relationship(uuid), private.in_chw_catchment(uuid), private.can_read_patient(uuid, text)
  from public, anon;
grant execute on function private.is_self_patient(uuid), private.is_caregiver_of(uuid, text),
  private.has_care_relationship(uuid), private.in_chw_catchment(uuid), private.can_read_patient(uuid, text)
  to authenticated, service_role;

-- ── Privileges ──────────────────────────────────────────────────────────────────────────────────

revoke all on patient.patient, patient.patient_identifier, patient.related_person, patient.consent
  from public, anon, authenticated;
grant select on patient.patient, patient.related_person, patient.consent to authenticated;
-- Identifier values: only the masked form is readable by clients; encrypted value and hash are not.
grant select (id, patient_id, system, value_masked, assigner_organization_id, period_start, period_end,
  verification_status, verified_by, verified_at, status, origin_device_id, created_at, updated_at, created_by,
  client_created_at, row_version) on patient.patient_identifier to authenticated;
grant select, insert, update on patient.patient, patient.patient_identifier, patient.related_person, patient.consent
  to service_role;

-- ── Policies ────────────────────────────────────────────────────────────────────────────────────

drop policy if exists patient_select on patient.patient;
create policy patient_select on patient.patient
  for select to authenticated
  using (private.can_read_patient(id));

drop policy if exists patient_identifier_select on patient.patient_identifier;
create policy patient_identifier_select on patient.patient_identifier
  for select to authenticated
  using (private.can_read_patient(patient_id));

drop policy if exists related_person_select on patient.related_person;
create policy related_person_select on patient.related_person
  for select to authenticated
  using (private.can_read_patient(patient_id) or person_id = (select identity.current_person_id()));

drop policy if exists consent_select on patient.consent;
create policy consent_select on patient.consent
  for select to authenticated
  using (private.can_read_patient(patient_id));

-- identity.person (created in 0006): own row, patients the caller may read, and the caregivers of those patients.
drop policy if exists person_select on identity.person;
create policy person_select on identity.person
  for select to authenticated
  using (
    user_account_id = (select auth.uid())
    or exists (select 1 from patient.patient as pa where pa.person_id = person.id and private.can_read_patient(pa.id))
    or exists (
      select 1 from patient.related_person as rp
      where rp.person_id = person.id and private.can_read_patient(rp.patient_id)
    )
  );
