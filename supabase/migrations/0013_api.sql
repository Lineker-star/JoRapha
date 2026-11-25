-- 0013_api: write API for the foundation (Step 1.2). Clients have SELECT only; every write goes through these
-- SECURITY DEFINER functions, which check role, organization, care relationship / catchment and consent authority,
-- validate input, set search_path = '' and write an audit event.
-- Phase 2 adds: patient registration (2.2), caregiver verification (2.2), provider onboarding (2.3), directory (2.4).

-- ── Devices (OFF-007) ───────────────────────────────────────────────────────────────────────────

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
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_device_id is null then
    raise exception 'device id is required' using errcode = '22023';
  end if;

  select d.user_account_id into v_owner from identity.device_registration as d where d.id = p_device_id;
  if found then
    if v_owner <> auth.uid() then
      raise exception 'device id belongs to another account' using errcode = '42501';
    end if;
    return p_device_id; -- idempotent retry
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
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select d.user_account_id into v_owner from identity.device_registration as d where d.id = p_device_id for update;
  if not found then
    raise exception 'device not found' using errcode = 'P0002';
  end if;
  if v_owner <> auth.uid() and not v_is_admin then
    raise exception 'not allowed to revoke this device' using errcode = '42501';
  end if;

  update identity.device_registration
     set trust_status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revocation_reason = p_reason
   where id = p_device_id and trust_status = 'active';

  perform private.log_event('revoke', 'identity', 'device_registration', p_device_id,
    p_reason => p_reason, p_actor_role => case when v_is_admin then 'platform_admin' end);
end;
$$;

-- ── Memberships (role model) ────────────────────────────────────────────────────────────────────
-- platform_admin (MFA): any role. facility_admin (MFA): staff roles in their own organization.
-- Nobody grants or ends their own memberships.

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
    )
  );
$$;
revoke execute on function private.may_manage_membership(text, uuid) from public, anon, authenticated;

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

  insert into identity.membership (user_account_id, role, organization_id, valid_from, valid_to, granted_by)
  values (p_user_account_id, p_role, p_organization_id, coalesce(p_valid_from, now()), p_valid_to, auth.uid())
  returning id into v_id;

  perform private.log_event('grant', 'identity', 'membership', v_id, p_reason => p_role);
  return v_id;
end;
$$;

create or replace function api.end_membership(p_membership_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m identity.membership%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  select * into v_m from identity.membership as m where m.id = p_membership_id for update;
  if not found then
    raise exception 'membership not found' using errcode = 'P0002';
  end if;
  if v_m.user_account_id = auth.uid() then
    raise exception 'memberships cannot be self-ended' using errcode = '42501';
  end if;
  if not private.may_manage_membership(v_m.role, v_m.organization_id) then
    raise exception 'not allowed to end this membership' using errcode = '42501';
  end if;

  update identity.membership
     set status = 'ended',
         valid_to = case when valid_to is null or valid_to > now() then now() else valid_to end,
         end_reason = p_reason
   where id = p_membership_id and status <> 'ended';

  perform private.log_event('revoke', 'identity', 'membership', p_membership_id, p_reason => p_reason);
end;
$$;

-- ── Consent (versioned, append-only; effective at server receipt) ───────────────────────────────

create or replace function private.check_own_device(p_device_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_device_id is not null and not exists (
    select 1 from identity.device_registration as d
    where d.id = p_device_id and d.user_account_id = auth.uid() and d.trust_status = 'active'
  ) then
    raise exception 'device is not an active device of this account' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function private.check_own_device(uuid) from public, anon, authenticated;

-- Who may record or withdraw a consent for a patient: the patient; a verified caregiver with give_consent
-- (must be the grantor); a CHW covering the patient's catchment (assisted enrolment, BRS §7.2).
create or replace function private.consent_authority(p_patient_id uuid, p_grantor_related_person_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_grantor_related_person_id is not null then
    if exists (
      select 1
      from patient.related_person as rp
      join identity.person as pe on pe.id = rp.person_id
      where rp.id = p_grantor_related_person_id
        and rp.patient_id = p_patient_id
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
  if private.in_chw_catchment(p_patient_id) then
    return 'chw';
  end if;
  return null;
end;
$$;
revoke execute on function private.consent_authority(uuid, uuid) from public, anon, authenticated;

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
  p_client_created_at timestamptz default null
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
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_consent_id is null or p_patient_id is null then
    raise exception 'consent id and patient id are required' using errcode = '22023';
  end if;

  -- Idempotent retry of the same operation.
  select c.patient_id into v_existing_patient from patient.consent as c where c.id = p_consent_id;
  if found then
    if v_existing_patient <> p_patient_id then
      raise exception 'consent id already used for another patient' using errcode = '42501';
    end if;
    return p_consent_id;
  end if;

  v_authority := private.consent_authority(p_patient_id, p_grantor_related_person_id);
  if v_authority is null then
    raise exception 'not allowed to record consent for this patient' using errcode = '42501';
  end if;
  perform private.check_own_device(p_device_id);

  -- Supersede the currently active consent for the same purpose and recipient.
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
    supersedes_id, policy_text_version, locale, recorded_by, origin_device_id, client_created_at)
  values (
    p_consent_id, p_patient_id,
    case when p_grantor_related_person_id is null then 'patient' else 'related_person' end,
    p_grantor_related_person_id, p_purpose, coalesce(p_scope_categories, '{}'),
    p_recipient_organization_id, p_recipient_practitioner_role_id, p_legal_basis, 'active', p_period_end,
    v_previous, p_policy_text_version, coalesce(p_locale, 'fr'), auth.uid(), p_device_id, p_client_created_at);

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
  if exists (select 1 from patient.consent as c where c.id = p_withdrawal_id and c.supersedes_id = p_consent_id) then
    return p_withdrawal_id; -- idempotent retry
  end if;

  select * into v_c from patient.consent as c where c.id = p_consent_id for update;
  if not found then
    raise exception 'consent not found' using errcode = 'P0002';
  end if;
  if v_c.status <> 'active' then
    raise exception 'only an active consent can be withdrawn' using errcode = '22023';
  end if;

  v_authority := private.consent_authority(v_c.patient_id, p_grantor_related_person_id);
  if v_authority is null then
    raise exception 'not allowed to withdraw consent for this patient' using errcode = '42501';
  end if;
  perform private.check_own_device(p_device_id);

  update patient.consent set status = 'superseded' where id = p_consent_id;

  insert into patient.consent (
    id, patient_id, grantor_kind, grantor_related_person_id, purpose, scope_categories,
    recipient_organization_id, recipient_practitioner_role_id, legal_basis, status, period_start,
    supersedes_id, policy_text_version, locale, recorded_by, origin_device_id, client_created_at)
  values (
    p_withdrawal_id, v_c.patient_id,
    case when p_grantor_related_person_id is null then 'patient' else 'related_person' end,
    p_grantor_related_person_id, v_c.purpose, v_c.scope_categories,
    v_c.recipient_organization_id, v_c.recipient_practitioner_role_id, v_c.legal_basis, 'withdrawn', now(),
    p_consent_id, v_c.policy_text_version, v_c.locale, auth.uid(), p_device_id, p_client_created_at);

  perform private.log_event('revoke', 'patient', 'consent', p_withdrawal_id, v_c.patient_id,
    p_reason => p_reason, p_actor_role => v_authority, p_purpose_of_use => v_c.purpose, p_device_id => p_device_id);
  return p_withdrawal_id;
end;
$$;

-- ── Break-glass access (PRD §5): time-limited, reason-coded, audited ────────────────────────────

create or replace function api.break_glass(p_patient_id uuid, p_practitioner_role_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  if auth.uid() is null or not identity.aal2() then
    raise exception 'break-glass requires an MFA session' using errcode = '42501';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 20 then
    raise exception 'break-glass requires a reason of at least 20 characters' using errcode = '22023';
  end if;

  select r.organization_id into v_org
  from provider.practitioner_role as r
  join provider.practitioner as pr on pr.id = r.practitioner_id
  join identity.person as pe on pe.id = pr.person_id
  where r.id = p_practitioner_role_id
    and pe.user_account_id = auth.uid()
    and r.status = 'active' and r.valid_from <= now() and (r.valid_to is null or r.valid_to > now())
    and pr.status = 'active';
  if not found or not identity.has_role('clinician', v_org) then
    raise exception 'an active clinician role is required' using errcode = '42501';
  end if;
  if not exists (select 1 from patient.patient as pa where pa.id = p_patient_id and pa.status = 'active') then
    raise exception 'patient not found' using errcode = 'P0002';
  end if;

  -- Duration: 2 hours, pending the clinical-governance decision (erd.md §5 item 3).
  insert into clinical.care_relationship (patient_id, practitioner_role_id, basis, valid_to, reason)
  values (p_patient_id, p_practitioner_role_id, 'break_glass', now() + interval '2 hours', p_reason)
  returning id into v_id;

  perform private.log_event('break_glass', 'clinical', 'care_relationship', v_id, p_patient_id,
    p_reason => p_reason, p_actor_role => 'clinician');
  return v_id;
end;
$$;

-- ── Privileges ──────────────────────────────────────────────────────────────────────────────────

revoke execute on function
  api.register_device(uuid, text, text, text, timestamptz),
  api.revoke_device(uuid, text),
  api.grant_membership(uuid, text, uuid, timestamptz, timestamptz),
  api.end_membership(uuid, text),
  api.record_consent(uuid, uuid, text, text, text[], text, uuid, uuid, uuid, text, timestamptz, uuid, timestamptz),
  api.withdraw_consent(uuid, uuid, text, uuid, uuid, timestamptz),
  api.break_glass(uuid, uuid, text)
  from public, anon;
grant execute on function
  api.register_device(uuid, text, text, text, timestamptz),
  api.revoke_device(uuid, text),
  api.grant_membership(uuid, text, uuid, timestamptz, timestamptz),
  api.end_membership(uuid, text),
  api.record_consent(uuid, uuid, text, text, text[], text, uuid, uuid, uuid, text, timestamptz, uuid, timestamptz),
  api.withdraw_consent(uuid, uuid, text, uuid, uuid, timestamptz),
  api.break_glass(uuid, uuid, text)
  to authenticated;

-- Label every device-reported column (erd.md §1.1).
do $$
declare
  r record;
begin
  for r in
    select table_schema, table_name from information_schema.columns
    where column_name = 'client_created_at'
      and table_schema in ('identity', 'patient', 'provider', 'clinical', 'community', 'audit', 'sync')
  loop
    execute format(
      'comment on column %I.%I.client_created_at is %L', r.table_schema, r.table_name,
      'Device-reported creation time. Source metadata only: never used as audit, ordering or legal time.');
  end loop;
end
$$;
