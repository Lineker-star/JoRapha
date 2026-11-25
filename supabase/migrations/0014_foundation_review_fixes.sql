-- 0014_foundation_review_fixes: findings of the security, clinical-safety and RLS reviews of Step 1.2.
-- 0005–0013 are applied to the dev project, so every fix is a redefinition or an ALTER here.

-- ── 1. Caller must hold an active account on every access path ──────────────────────────────────

create or replace function private.caller_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from identity.user_account as u where u.id = auth.uid() and u.status = 'active');
$$;
revoke execute on function private.caller_active() from public, anon;
grant execute on function private.caller_active() to authenticated, service_role;

create or replace function identity.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from identity.person as p
  join identity.user_account as u on u.id = p.user_account_id
  where p.user_account_id = auth.uid() and u.status = 'active';
$$;

create or replace function private.is_own_practitioner(p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.caller_active() and exists (
    select 1
    from provider.practitioner as pr
    join identity.person as pe on pe.id = pr.person_id
    where pr.id = p_practitioner_id and pe.user_account_id = auth.uid()
  );
$$;

create or replace function private.owns_practitioner_role(p_practitioner_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.caller_active() and exists (
    select 1
    from provider.practitioner_role as r
    join provider.practitioner as pr on pr.id = r.practitioner_id
    join identity.person as pe on pe.id = pr.person_id
    where r.id = p_practitioner_role_id and pe.user_account_id = auth.uid()
  );
$$;

-- Facility admin (MFA) of an organization where the practitioner holds a CURRENT role.
create or replace function private.admins_practitioner(p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select identity.aal2() and exists (
    select 1 from provider.practitioner_role as r
    where r.practitioner_id = p_practitioner_id
      and r.status = 'active' and r.valid_from <= now() and (r.valid_to is null or r.valid_to > now())
      and identity.has_role('facility_admin', r.organization_id)
  );
$$;

-- Practitioner has an expired registration or licence (RULE-01).
create or replace function private.practitioner_licence_expired(p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from provider.credential as c
    where c.practitioner_id = p_practitioner_id
      and c.kind in ('registration', 'licence')
      and (c.verification_status = 'expired' or (c.expires_on is not null and c.expires_on < current_date))
  );
$$;
revoke execute on function private.practitioner_licence_expired(uuid) from public, anon;
grant execute on function private.practitioner_licence_expired(uuid) to authenticated, service_role;

-- ── 2. Patient predicates ───────────────────────────────────────────────────────────────────────

create or replace function private.is_self_patient(p_patient_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.caller_active() and exists (
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
  return private.caller_active() and exists (
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

-- Clinician: MFA, active patient, active + verified organization, current role, active practitioner
-- without an expired licence, active clinician membership, current care relationship.
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
    join patient.patient as pa on pa.id = cr.patient_id
    join provider.practitioner_role as r on r.id = cr.practitioner_role_id
    join provider.organization as o on o.id = r.organization_id
    join provider.practitioner as pr on pr.id = r.practitioner_id
    join identity.person as pe on pe.id = pr.person_id
    where cr.patient_id = p_patient_id
      and pa.status = 'active'
      and pe.user_account_id = auth.uid()
      and cr.status = 'active' and cr.valid_from <= now() and cr.valid_to > now()
      and r.status = 'active' and r.valid_from <= now() and (r.valid_to is null or r.valid_to > now())
      and o.status = 'active' and o.verification_status = 'verified'
      and pr.status = 'active'
      and not private.practitioner_licence_expired(pr.id)
      and identity.has_role('clinician', r.organization_id)
  );
end;
$$;

-- CHW (or supervisor with MFA) covering the catchment of an active patient's current household,
-- in an active, verified organization.
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
    join patient.patient as pa on pa.id = hm.patient_id
    join community.household as h on h.id = hm.household_id
    join community.catchment as c on c.id = h.catchment_id
    join provider.organization as o on o.id = c.organization_id
    join community.chw_assignment as a on a.catchment_id = c.id
    where hm.patient_id = p_patient_id
      and pa.status = 'active'
      and hm.valid_from <= now() and (hm.valid_to is null or hm.valid_to > now())
      and h.status = 'active' and c.status = 'active'
      and o.status = 'active' and o.verification_status = 'verified'
      and a.status = 'active' and a.valid_from <= now() and (a.valid_to is null or a.valid_to > now())
      and (
        (a.user_account_id = auth.uid() and identity.has_role('chw', c.organization_id))
        or (a.supervisor_user_id = auth.uid() and identity.aal2()
            and identity.has_role('chw_supervisor', c.organization_id))
      )
  );
end;
$$;

-- The assigned CHW only (not the supervisor): used for assisted consent capture.
create or replace function private.is_assigned_chw(p_patient_id uuid)
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
    join patient.patient as pa on pa.id = hm.patient_id
    join community.household as h on h.id = hm.household_id
    join community.catchment as c on c.id = h.catchment_id
    join provider.organization as o on o.id = c.organization_id
    join community.chw_assignment as a on a.catchment_id = c.id
    where hm.patient_id = p_patient_id
      and pa.status = 'active'
      and hm.valid_from <= now() and (hm.valid_to is null or hm.valid_to > now())
      and h.status = 'active' and c.status = 'active'
      and o.status = 'active' and o.verification_status = 'verified'
      and a.status = 'active' and a.valid_from <= now() and (a.valid_to is null or a.valid_to > now())
      and a.user_account_id = auth.uid()
      and identity.has_role('chw', c.organization_id)
  );
end;
$$;

-- The clinical record (encounters, observations, results… from Phase 3) uses THIS predicate:
-- the patient, a caregiver with the scope, or a clinician in a care relationship. Never CHWs (PRD §5).
create or replace function private.can_read_clinical(p_patient_id uuid, p_scope text default 'view_record')
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.is_self_patient(p_patient_id)
    or private.is_caregiver_of(p_patient_id, p_scope)
    or private.has_care_relationship(p_patient_id);
end;
$$;

-- Everyone allowed to see a patient's caregiver links except other caregivers (who see only their own).
create or replace function private.can_read_patient_links(p_patient_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.is_self_patient(p_patient_id)
    or private.has_care_relationship(p_patient_id)
    or private.in_chw_catchment(p_patient_id);
end;
$$;

revoke execute on function private.is_assigned_chw(uuid), private.can_read_clinical(uuid, text),
  private.can_read_patient_links(uuid) from public, anon;
grant execute on function private.is_assigned_chw(uuid), private.can_read_clinical(uuid, text),
  private.can_read_patient_links(uuid) to authenticated, service_role;

-- ── 3. Community predicates ─────────────────────────────────────────────────────────────────────

create or replace function private.covers_catchment(p_catchment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from community.chw_assignment as a
    join community.catchment as c on c.id = a.catchment_id
    join provider.organization as o on o.id = c.organization_id
    where a.catchment_id = p_catchment_id
      and c.status = 'active'
      and o.status = 'active' and o.verification_status = 'verified'
      and a.status = 'active' and a.valid_from <= now() and (a.valid_to is null or a.valid_to > now())
      and (
        (a.user_account_id = auth.uid() and identity.has_role('chw', c.organization_id))
        or (a.supervisor_user_id = auth.uid() and identity.aal2()
            and identity.has_role('chw_supervisor', c.organization_id))
      )
  );
$$;

-- ── 4. Policies narrowed ────────────────────────────────────────────────────────────────────────

-- Caregivers see their own links only (not other caregivers of the same dependant).
drop policy if exists related_person_select on patient.related_person;
create policy related_person_select on patient.related_person
  for select to authenticated
  using (private.can_read_patient_links(patient_id) or person_id = (select identity.current_person_id()));

-- Person rows of other caregivers are not visible to a caregiver.
drop policy if exists person_select on identity.person;
create policy person_select on identity.person
  for select to authenticated
  using (
    (user_account_id = (select auth.uid()) and (select private.caller_active()))
    or exists (select 1 from patient.patient as pa where pa.person_id = person.id and private.can_read_patient(pa.id))
    or exists (
      select 1 from patient.related_person as rp
      where rp.person_id = person.id and private.can_read_patient_links(rp.patient_id)
    )
  );

-- CHWs read only the consents they recorded.
drop policy if exists consent_select on patient.consent;
create policy consent_select on patient.consent
  for select to authenticated
  using (
    private.can_read_clinical(patient_id)
    or (recorded_by = (select auth.uid()) and private.in_chw_catchment(patient_id))
  );

-- Licence evidence is not part of the public directory.
revoke select on provider.organization from authenticated;
grant select (id, kind, name, part_of_id, licence_number, verification_status, verified_by, verified_at, status,
  phone, email, created_at, updated_at, created_by, client_created_at, row_version)
  on provider.organization to authenticated;

-- ── 5. Status and validity may only move in allowed directions ──────────────────────────────────

-- Arguments: the status column name, then allowed 'from>to' pairs.
create or replace function private.guard_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_col text := tg_argv[0];
  v_old text := to_jsonb(old) ->> v_col;
  v_new text := to_jsonb(new) ->> v_col;
begin
  if v_old is distinct from v_new and not (v_old || '>' || v_new = any (tg_argv[1:])) then
    raise exception '%.%: % may not change from % to %', tg_table_schema, tg_table_name, v_col, v_old, v_new
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- valid_to may only move earlier (an open-ended period may be given an end).
create or replace function private.guard_valid_to_shrink()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.valid_to is not null and (new.valid_to is null or new.valid_to > old.valid_to) then
    raise exception '%.%: valid_to may only move earlier', tg_table_schema, tg_table_name using errcode = '42501';
  end if;
  return new;
end;
$$;

-- clinical.care_relationship: review columns, end attribution, transitions.
alter table clinical.care_relationship add column if not exists reviewed_by uuid references identity.user_account (id);
alter table clinical.care_relationship add column if not exists reviewed_at timestamptz;
alter table clinical.care_relationship drop constraint if exists care_relationship_end_recorded;
alter table clinical.care_relationship add constraint care_relationship_end_recorded
  check (status <> 'ended' or (ended_by is not null and end_reason is not null));
select private.add_row_triggers('clinical.care_relationship',
  array['status', 'valid_to', 'ended_by', 'end_reason', 'reviewed_by', 'reviewed_at']);
create or replace trigger c_status_transition before update on clinical.care_relationship
  for each row execute function private.guard_status_transition('status', 'active>ended', 'active>entered_in_error');
create or replace trigger c_valid_to_shrink before update on clinical.care_relationship
  for each row execute function private.guard_valid_to_shrink();

-- patient.consent
create or replace trigger c_status_transition before update on patient.consent
  for each row execute function private.guard_status_transition('status',
    'active>superseded', 'active>entered_in_error', 'withdrawn>entered_in_error');

-- patient.patient: attributed status changes, no self-merge.
alter table patient.patient add column if not exists status_changed_by uuid references identity.user_account (id);
alter table patient.patient add column if not exists status_reason text check (char_length(status_reason) <= 500);
alter table patient.patient drop constraint if exists patient_status_change_recorded;
alter table patient.patient add constraint patient_status_change_recorded
  check (status = 'active' or (status_changed_by is not null and status_reason is not null));
alter table patient.patient drop constraint if exists patient_not_merged_into_self;
alter table patient.patient add constraint patient_not_merged_into_self check (merged_into_id is distinct from id);
select private.add_row_triggers('patient.patient',
  array['status', 'merged_into_id', 'deceased_at', 'status_changed_by', 'status_reason']);
create or replace trigger c_status_transition before update on patient.patient
  for each row execute function private.guard_status_transition('status',
    'active>inactive', 'active>merged', 'active>entered_in_error',
    'inactive>active', 'inactive>merged', 'inactive>entered_in_error');

-- patient.related_person
create or replace trigger c_status_transition before update on patient.related_person
  for each row execute function private.guard_status_transition('verification_status',
    'pending>verified', 'pending>rejected', 'verified>expired', 'verified>revoked', 'pending>revoked');
create or replace trigger c_valid_to_shrink before update on patient.related_person
  for each row execute function private.guard_valid_to_shrink();

-- identity.membership: role, organization and holder are immutable; only ending is allowed.
select private.add_row_triggers('identity.membership', array['status', 'valid_to', 'end_reason']);
create or replace trigger c_status_transition before update on identity.membership
  for each row execute function private.guard_status_transition('status',
    'active>ended', 'active>suspended', 'suspended>active', 'suspended>ended');
create or replace trigger c_valid_to_shrink before update on identity.membership
  for each row execute function private.guard_valid_to_shrink();

-- identity.device_registration: identity of the device is immutable; revocation is final.
select private.add_row_triggers('identity.device_registration',
  array['trust_status', 'revoked_at', 'revoked_by', 'revocation_reason', 'last_sync_at', 'app_version']);
create or replace trigger c_status_transition before update on identity.device_registration
  for each row execute function private.guard_status_transition('trust_status', 'active>revoked');

-- community
create or replace trigger c_status_transition before update on community.chw_assignment
  for each row execute function private.guard_status_transition('status', 'active>ended');
create or replace trigger c_valid_to_shrink before update on community.chw_assignment
  for each row execute function private.guard_valid_to_shrink();
create or replace trigger c_valid_to_shrink before update on community.household_member
  for each row execute function private.guard_valid_to_shrink();

-- ── 6. Attribution ──────────────────────────────────────────────────────────────────────────────

-- service_role (sync-ingest, Edge Functions) has no JWT user: it must state created_by explicitly,
-- taken from the verified token of the device user.
create or replace function private.stamp_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
    new.row_version := 1;
    if auth.uid() is not null then
      new.created_by := auth.uid();
    elsif current_user = 'service_role' and new.created_by is null then
      raise exception 'created_by is required for service_role writes on %.%', tg_table_schema, tg_table_name
        using errcode = '23502';
    end if;
  else
    if new.id is distinct from old.id then
      raise exception 'id is immutable on %.%', tg_table_schema, tg_table_name using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.client_created_at := old.client_created_at;
    new.updated_at := now();
    new.row_version := old.row_version + 1;
  end if;
  return new;
end;
$$;

-- Identity-critical demographic changes are audited (field names only, never values).
create or replace function private.audit_person_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed text[] := array[]::text[];
begin
  if new.family_name is distinct from old.family_name then v_changed := array_append(v_changed, 'family_name'); end if;
  if new.given_names is distinct from old.given_names then v_changed := array_append(v_changed, 'given_names'); end if;
  if new.birth_date is distinct from old.birth_date then v_changed := array_append(v_changed, 'birth_date'); end if;
  if new.birth_date_precision is distinct from old.birth_date_precision then
    v_changed := array_append(v_changed, 'birth_date_precision');
  end if;
  if new.sex is distinct from old.sex then v_changed := array_append(v_changed, 'sex'); end if;
  if new.user_account_id is distinct from old.user_account_id then v_changed := array_append(v_changed, 'user_account_id'); end if;
  if cardinality(v_changed) > 0 then
    insert into audit.audit_event (actor_user_id, action, entity_schema, entity_table, entity_id, patient_id, reason, created_by)
    values (auth.uid(), 'amend', 'identity', 'person', new.id,
      (select pa.id from patient.patient as pa where pa.person_id = new.id),
      'identity-critical fields changed: ' || array_to_string(v_changed, ', '),
      coalesce(auth.uid(), new.created_by));
  end if;
  return new;
end;
$$;
create or replace trigger d_audit_identity_change after update on identity.person
  for each row execute function private.audit_person_change();

-- ── 7. Sync: the server-side initial state is 'pending', never 'received' (OFF-006, RULE-03) ─────

alter table sync.operation drop constraint if exists operation_state_check;
update sync.operation set state = 'pending' where state = 'received';
alter table sync.operation alter column state set default 'pending';
alter table sync.operation add constraint operation_state_check
  check (state in ('pending', 'applied', 'rejected', 'conflict'));

-- ── 8. Consent: assisted capture is marked, evidenced and limited ───────────────────────────────

alter table patient.consent drop constraint if exists consent_grantor_kind_check;
alter table patient.consent add constraint consent_grantor_kind_check
  check (grantor_kind in ('patient', 'related_person', 'assisted_chw'));
alter table patient.consent drop constraint if exists consent_assisted_evidenced;
alter table patient.consent add constraint consent_assisted_evidenced
  check (grantor_kind <> 'assisted_chw' or evidence_object_path is not null);

create or replace function private.consent_authority(p_patient_id uuid, p_grantor_related_person_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.caller_active() then
    return null;
  end if;
  if p_grantor_related_person_id is not null then
    if exists (
      select 1
      from patient.related_person as rp
      join identity.person as pe on pe.id = rp.person_id
      join patient.patient as pa on pa.id = rp.patient_id
      where rp.id = p_grantor_related_person_id
        and rp.patient_id = p_patient_id
        and pa.status = 'active'
        and pe.user_account_id = auth.uid()
        and rp.verification_status = 'verified'
        and rp.valid_from <= now() and (rp.valid_to is null or rp.valid_to > now())
        and 'give_consent' = any (rp.authority_scope)
    ) then
      return 'caregiver';
    end if;
    return null;
  end if;
  if private.is_self_patient(p_patient_id) then
    return 'patient';
  end if;
  if private.is_assigned_chw(p_patient_id) then
    return 'chw';
  end if;
  return null;
end;
$$;
revoke execute on function private.consent_authority(uuid, uuid) from public, anon, authenticated;

drop function if exists api.record_consent(uuid, uuid, text, text, text[], text, uuid, uuid, uuid, text, timestamptz, uuid, timestamptz);
create or replace function api.record_consent(
  p_consent_id uuid,
  p_patient_id uuid,
  p_purpose text,
  p_policy_text_version text,
  p_scope_categories text[] default '{}',
  p_locale text default 'fr',
  p_grantor_related_person_id uuid default null,
  p_recipient_organization_id uuid default null,
  p_recipient_practitioner_role_id uuid default null,
  p_legal_basis text default null,
  p_period_end timestamptz default null,
  p_device_id uuid default null,
  p_client_created_at timestamptz default null,
  p_evidence_object_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authority text;
  v_existing_patient uuid;
  v_previous uuid;
  v_grantor_kind text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_consent_id is null or p_patient_id is null then
    raise exception 'consent id and patient id are required' using errcode = '22023';
  end if;

  -- Authority first, so the idempotent path reveals nothing to an unauthorized caller.
  v_authority := private.consent_authority(p_patient_id, p_grantor_related_person_id);
  if v_authority is null then
    raise exception 'not allowed to record consent for this patient' using errcode = '42501';
  end if;

  select c.patient_id into v_existing_patient from patient.consent as c where c.id = p_consent_id;
  if found then
    if v_existing_patient <> p_patient_id then
      raise exception 'consent id already used for another patient' using errcode = '42501';
    end if;
    return p_consent_id;
  end if;

  if v_authority = 'chw' and (p_evidence_object_path is null or char_length(trim(p_evidence_object_path)) = 0) then
    raise exception 'consent captured by a CHW requires evidence (signed form, audio or witness record)'
      using errcode = '22023';
  end if;
  perform private.check_own_device(p_device_id);

  v_grantor_kind := case v_authority when 'caregiver' then 'related_person' when 'chw' then 'assisted_chw' else 'patient' end;

  select c.id into v_previous
  from patient.consent as c
  where c.patient_id = p_patient_id
    and c.purpose = p_purpose
    and c.status = 'active'
    and c.recipient_organization_id is not distinct from p_recipient_organization_id
    and c.recipient_practitioner_role_id is not distinct from p_recipient_practitioner_role_id
  for update;
  if found then
    update patient.consent set status = 'superseded' where id = v_previous;
  end if;

  insert into patient.consent (
    id, patient_id, grantor_kind, grantor_related_person_id, purpose, scope_categories,
    recipient_organization_id, recipient_practitioner_role_id, legal_basis, status, period_end,
    supersedes_id, policy_text_version, locale, recorded_by, evidence_object_path, origin_device_id, client_created_at)
  values (
    p_consent_id, p_patient_id, v_grantor_kind, p_grantor_related_person_id, p_purpose, coalesce(p_scope_categories, '{}'),
    p_recipient_organization_id, p_recipient_practitioner_role_id, p_legal_basis, 'active', p_period_end,
    v_previous, p_policy_text_version, coalesce(p_locale, 'fr'), auth.uid(), p_evidence_object_path, p_device_id,
    p_client_created_at);

  perform private.log_event('create', 'patient', 'consent', p_consent_id, p_patient_id,
    p_actor_role => v_authority, p_purpose_of_use => p_purpose, p_device_id => p_device_id);
  return p_consent_id;
end;
$$;

create or replace function api.withdraw_consent(
  p_consent_id uuid,
  p_withdrawal_id uuid,
  p_reason text,
  p_grantor_related_person_id uuid default null,
  p_device_id uuid default null,
  p_client_created_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c patient.consent%rowtype;
  v_authority text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_withdrawal_id is null then
    raise exception 'withdrawal id is required' using errcode = '22023';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select * into v_c from patient.consent as c where c.id = p_consent_id for update;
  if not found then
    raise exception 'not allowed to withdraw this consent' using errcode = '42501';
  end if;

  v_authority := private.consent_authority(v_c.patient_id, p_grantor_related_person_id);
  -- A CHW may only withdraw a consent they captured themselves.
  if v_authority is null or (v_authority = 'chw' and v_c.recorded_by is distinct from auth.uid()) then
    raise exception 'not allowed to withdraw this consent' using errcode = '42501';
  end if;

  if exists (select 1 from patient.consent as c where c.id = p_withdrawal_id and c.supersedes_id = p_consent_id) then
    return p_withdrawal_id; -- idempotent retry
  end if;
  if v_c.status <> 'active' then
    raise exception 'only an active consent can be withdrawn' using errcode = '22023';
  end if;
  perform private.check_own_device(p_device_id);

  update patient.consent set status = 'superseded' where id = p_consent_id;

  insert into patient.consent (
    id, patient_id, grantor_kind, grantor_related_person_id, purpose, scope_categories,
    recipient_organization_id, recipient_practitioner_role_id, legal_basis, status, period_start,
    supersedes_id, policy_text_version, locale, recorded_by, evidence_object_path, origin_device_id, client_created_at)
  values (
    p_withdrawal_id, v_c.patient_id,
    case v_authority when 'caregiver' then 'related_person' when 'chw' then 'assisted_chw' else 'patient' end,
    p_grantor_related_person_id, v_c.purpose, v_c.scope_categories,
    v_c.recipient_organization_id, v_c.recipient_practitioner_role_id, v_c.legal_basis, 'withdrawn', now(),
    p_consent_id, v_c.policy_text_version, v_c.locale, auth.uid(),
    case when v_authority = 'chw' then v_c.evidence_object_path end, p_device_id, p_client_created_at);

  perform private.log_event('revoke', 'patient', 'consent', p_withdrawal_id, v_c.patient_id,
    p_reason => p_reason, p_actor_role => v_authority, p_purpose_of_use => v_c.purpose, p_device_id => p_device_id);
  return p_withdrawal_id;
end;
$$;

-- ── 9. Memberships, devices and break-glass ─────────────────────────────────────────────────────

create or replace function private.may_manage_membership(p_role text, p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select identity.aal2() and (
    identity.has_role('platform_admin')
    or (
      p_organization_id is not null
      and p_role in ('clinician', 'chw', 'chw_supervisor', 'lab_staff', 'pharmacy_staff')
      and identity.has_role('facility_admin', p_organization_id)
      and exists (
        select 1 from provider.organization as o
        where o.id = p_organization_id and o.status = 'active' and o.verification_status = 'verified'
      )
    )
  );
$$;

create or replace function api.grant_membership(
  p_user_account_id uuid,
  p_role text,
  p_organization_id uuid default null,
  p_valid_from timestamptz default now(),
  p_valid_to timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_user_account_id = auth.uid() then
    raise exception 'memberships cannot be self-granted' using errcode = '42501';
  end if;
  if not private.may_manage_membership(p_role, p_organization_id) then
    raise exception 'not allowed to grant role % in this organization', p_role using errcode = '42501';
  end if;
  if not exists (select 1 from identity.user_account as u where u.id = p_user_account_id and u.status = 'active') then
    raise exception 'the account is not active' using errcode = '22023';
  end if;

  -- No backdating: a membership starts now or later.
  insert into identity.membership (user_account_id, role, organization_id, valid_from, valid_to, granted_by)
  values (p_user_account_id, p_role, p_organization_id, greatest(coalesce(p_valid_from, now()), now()), p_valid_to, auth.uid())
  returning id into v_id;

  perform private.log_event('grant', 'identity', 'membership', v_id, p_reason => p_role);
  return v_id;
end;
$$;

create or replace function api.register_device(
  p_device_id uuid,
  p_app text,
  p_platform text,
  p_app_version text default null,
  p_client_created_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null or not private.caller_active() then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_device_id is null then
    raise exception 'device id is required' using errcode = '22023';
  end if;

  select d.user_account_id into v_owner from identity.device_registration as d where d.id = p_device_id;
  if found then
    if v_owner <> auth.uid() then
      perform private.log_event('denied', 'identity', 'device_registration', p_device_id,
        p_outcome => 'denied', p_reason => 'device id collision');
      raise exception 'device id belongs to another account' using errcode = '42501';
    end if;
    return p_device_id;
  end if;
  if (select count(*) from identity.device_registration as d
       where d.user_account_id = auth.uid() and d.trust_status = 'active') >= 10 then
    raise exception 'too many active devices; revoke one first' using errcode = '22023';
  end if;

  insert into identity.device_registration (id, user_account_id, app, platform, app_version, client_created_at)
  values (p_device_id, auth.uid(), p_app, p_platform, p_app_version, p_client_created_at);

  perform private.log_event('create', 'identity', 'device_registration', p_device_id, p_device_id => p_device_id);
  return p_device_id;
end;
$$;

create or replace function api.revoke_device(p_device_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_is_admin boolean := identity.aal2() and identity.has_role('platform_admin');
begin
  if auth.uid() is null or not private.caller_active() then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select d.user_account_id into v_owner from identity.device_registration as d where d.id = p_device_id for update;
  if not found or (v_owner <> auth.uid() and not v_is_admin) then
    raise exception 'not allowed to revoke this device' using errcode = '42501';
  end if;

  update identity.device_registration
     set trust_status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revocation_reason = p_reason
   where id = p_device_id and trust_status = 'active';

  perform private.log_event('revoke', 'identity', 'device_registration', p_device_id,
    p_reason => p_reason, p_actor_role => case when v_is_admin then 'platform_admin' end);
end;
$$;

-- Break-glass: verified active organization, unexpired licence, no re-issue while one is active,
-- at most 5 per clinician per 24 h; rows with reviewed_at null form the review queue.
create or replace function api.break_glass(p_patient_id uuid, p_practitioner_role_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_practitioner uuid;
  v_id uuid;
begin
  if auth.uid() is null or not identity.aal2() then
    raise exception 'break-glass requires an MFA session' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 20 then
    raise exception 'break-glass requires a reason of at least 20 characters' using errcode = '22023';
  end if;

  select r.organization_id, pr.id into v_org, v_practitioner
  from provider.practitioner_role as r
  join provider.practitioner as pr on pr.id = r.practitioner_id
  join provider.organization as o on o.id = r.organization_id
  join identity.person as pe on pe.id = pr.person_id
  where r.id = p_practitioner_role_id
    and pe.user_account_id = auth.uid()
    and r.status = 'active' and r.valid_from <= now() and (r.valid_to is null or r.valid_to > now())
    and o.status = 'active' and o.verification_status = 'verified'
    and pr.status = 'active';
  if not found or not identity.has_role('clinician', v_org) or private.practitioner_licence_expired(v_practitioner) then
    raise exception 'an active clinician role in a verified organization is required' using errcode = '42501';
  end if;
  if not exists (select 1 from patient.patient as pa where pa.id = p_patient_id and pa.status = 'active') then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from clinical.care_relationship as cr
    where cr.patient_id = p_patient_id and cr.practitioner_role_id = p_practitioner_role_id
      and cr.basis = 'break_glass' and cr.status = 'active' and cr.valid_to > now()
  ) then
    raise exception 'a break-glass access to this patient is already active' using errcode = '22023';
  end if;
  if (
    select count(*) from clinical.care_relationship as cr
    join provider.practitioner_role as r on r.id = cr.practitioner_role_id
    where r.practitioner_id = v_practitioner and cr.basis = 'break_glass' and cr.created_at > now() - interval '24 hours'
  ) >= 5 then
    raise exception 'break-glass limit reached (5 per 24 hours); contact clinical governance' using errcode = '22023';
  end if;

  insert into clinical.care_relationship (patient_id, practitioner_role_id, basis, valid_to, reason)
  values (p_patient_id, p_practitioner_role_id, 'break_glass', now() + interval '2 hours', p_reason)
  returning id into v_id;

  perform private.log_event('break_glass', 'clinical', 'care_relationship', v_id, p_patient_id,
    p_reason => p_reason, p_actor_role => 'clinician');
  return v_id;
end;
$$;

revoke execute on function
  api.record_consent(uuid, uuid, text, text, text[], text, uuid, uuid, uuid, text, timestamptz, uuid, timestamptz, text)
  from public, anon;
grant execute on function
  api.record_consent(uuid, uuid, text, text, text[], text, uuid, uuid, uuid, text, timestamptz, uuid, timestamptz, text)
  to authenticated;
