-- 0009_clinical: care relationships — the only basis of a clinician's access to a patient (PRD §5).
-- Design: docs/design/erd.md §3 (clinical.care_relationship) and §4. Step 1.2.
-- Clinical tables are append-only: a relationship ends by setting valid_to / status, never by deletion.

create table if not exists clinical.care_relationship (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patient.patient (id),
  practitioner_role_id uuid not null references provider.practitioner_role (id),
  basis text not null check (basis in ('appointment', 'encounter', 'referral', 'facility_assignment', 'break_glass')),
  basis_ref_id uuid,
  valid_from timestamptz not null default now(),
  valid_to timestamptz not null, -- always time-limited
  reason text check (char_length(reason) <= 1000),
  status text not null default 'active' check (status in ('active', 'ended', 'entered_in_error')),
  ended_by uuid references identity.user_account (id),
  end_reason text check (char_length(end_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint care_relationship_validity check (valid_to >= valid_from),
  constraint care_relationship_break_glass_reason check (basis <> 'break_glass' or char_length(reason) >= 20)
);
create index if not exists care_relationship_patient_idx on clinical.care_relationship (patient_id) where status = 'active';
create index if not exists care_relationship_role_idx on clinical.care_relationship (practitioner_role_id) where status = 'active';

select private.add_row_triggers('clinical.care_relationship', array['status', 'valid_to', 'ended_by', 'end_reason']);

alter table clinical.care_relationship enable row level security;
alter table clinical.care_relationship force row level security;

create or replace function private.owns_practitioner_role(p_practitioner_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from provider.practitioner_role as r
    join provider.practitioner as pr on pr.id = r.practitioner_id
    join identity.person as pe on pe.id = pr.person_id
    where r.id = p_practitioner_role_id and pe.user_account_id = auth.uid()
  );
$$;
revoke execute on function private.owns_practitioner_role(uuid) from public, anon;
grant execute on function private.owns_practitioner_role(uuid) to authenticated, service_role;

revoke all on clinical.care_relationship from public, anon, authenticated;
grant select on clinical.care_relationship to authenticated;
grant select, insert, update on clinical.care_relationship to service_role;

-- Patients and caregivers see who can see them; clinicians see their own relationships (MFA).
drop policy if exists care_relationship_select on clinical.care_relationship;
create policy care_relationship_select on clinical.care_relationship
  for select to authenticated
  using (
    private.is_self_patient(patient_id)
    or private.is_caregiver_of(patient_id, 'view_record')
    or ((select identity.aal2()) and private.owns_practitioner_role(practitioner_role_id))
  );
