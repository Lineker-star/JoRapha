-- 0011_audit: append-only audit trail (RULE-10). Design: docs/design/erd.md §3 (audit.audit_event). Step 1.2.
-- Step 1.3 adds read logging and the patient access history; this migration provides the table and the writer.

create table if not exists audit.audit_event (
  id uuid primary key default gen_random_uuid(), -- server-generated
  occurred_at timestamptz not null default now(), -- server time; forced by trigger, never device time
  actor_user_id uuid references identity.user_account (id),
  actor_role text check (char_length(actor_role) <= 50),
  on_behalf_of_patient_id uuid references patient.patient (id),
  action text not null check (action in (
    'create', 'read', 'amend', 'end', 'export', 'login', 'grant', 'revoke', 'break_glass', 'denied')),
  entity_schema text not null check (char_length(entity_schema) <= 63),
  entity_table text not null check (char_length(entity_table) <= 63),
  entity_id uuid,
  patient_id uuid references patient.patient (id),
  purpose_of_use text check (char_length(purpose_of_use) <= 100),
  device_id uuid references identity.device_registration (id),
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'error')),
  correlation_id uuid,
  reason text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz, -- device time of an offline event; metadata only
  row_version integer not null default 1
);
comment on table audit.audit_event is 'Append-only audit trail. Holds references only, never clinical content (erd.md).';
create index if not exists audit_event_patient_idx on audit.audit_event (patient_id, occurred_at desc);
create index if not exists audit_event_actor_idx on audit.audit_event (actor_user_id, occurred_at desc);

-- Fully append-only: no column may change, no row may be deleted, for any role including service_role.
select private.add_row_triggers('audit.audit_event', '{}'::text[]);

-- The audit time is the server's: whatever a caller sends, occurred_at becomes now().
create or replace function private.audit_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.occurred_at := now();
  return new;
end;
$$;
create or replace trigger a_audit_server_time
  before insert on audit.audit_event
  for each row execute function private.audit_server_time();

alter table audit.audit_event enable row level security;
alter table audit.audit_event force row level security;

-- Writer used by api.* functions (runs as the definer; callers cannot write audit rows directly).
create or replace function private.log_event(
  p_action text,
  p_entity_schema text,
  p_entity_table text,
  p_entity_id uuid,
  p_patient_id uuid default null,
  p_reason text default null,
  p_actor_role text default null,
  p_outcome text default 'success',
  p_purpose_of_use text default null,
  p_device_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into audit.audit_event (
    actor_user_id, actor_role, action, entity_schema, entity_table, entity_id, patient_id,
    purpose_of_use, device_id, outcome, reason)
  values (
    auth.uid(), p_actor_role, p_action, p_entity_schema, p_entity_table, p_entity_id, p_patient_id,
    p_purpose_of_use, p_device_id, p_outcome, p_reason)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.log_event(text, text, text, uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;

revoke all on audit.audit_event from public, anon, authenticated;
grant select on audit.audit_event to authenticated;
grant select, insert on audit.audit_event to service_role;

-- Patients and caregivers read their own access history; platform admins (MFA) read all.
drop policy if exists audit_event_select on audit.audit_event;
create policy audit_event_select on audit.audit_event
  for select to authenticated
  using (
    (patient_id is not null and (private.is_self_patient(patient_id) or private.is_caregiver_of(patient_id, 'view_record')))
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );
