-- 0012_sync: offline upload log and conflict queue (TA §7.2, PRD OFF-004/OFF-005).
-- Design: docs/design/erd.md §3 (sync.operation, sync.conflict). Step 1.2.
-- Written only by the sync-ingest Edge Function (service_role); devices read the state of their own operations.

create table if not exists sync.operation (
  id uuid primary key, -- client-generated operation id
  device_id uuid not null references identity.device_registration (id),
  user_account_id uuid not null references identity.user_account (id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  local_sequence bigint not null check (local_sequence >= 0),
  schema_version integer not null check (schema_version > 0),
  entity_table text not null check (char_length(entity_table) <= 130),
  entity_id uuid not null,
  base_row_version integer check (base_row_version > 0),
  op text not null check (op in ('insert', 'amend', 'field_update', 'request')),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'), -- the payload itself is not kept
  state text not null default 'received' check (state in ('received', 'applied', 'rejected', 'conflict')),
  reason_code text check (char_length(reason_code) <= 100),
  result jsonb,
  received_at timestamptz not null default now(),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint operation_idempotent unique (device_id, idempotency_key),
  constraint operation_rejection_reason check (state <> 'rejected' or reason_code is not null)
);
create index if not exists operation_user_idx on sync.operation (user_account_id, received_at desc);

create table if not exists sync.conflict (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references sync.operation (id),
  entity_table text not null check (char_length(entity_table) <= 130),
  entity_id uuid not null,
  fields text[] not null default '{}',
  server_row_version integer,
  client_values_encrypted bytea,
  status text not null default 'open'
    check (status in ('open', 'resolved_keep_server', 'resolved_apply_client', 'resolved_manual')),
  resolved_by uuid references identity.user_account (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint conflict_resolution_recorded check (status = 'open' or (resolved_by is not null and resolved_at is not null))
);

-- Operations: only processing state may change; the submitted facts are immutable.
select private.add_row_triggers('sync.operation', array['state', 'reason_code', 'result', 'applied_at']);
select private.add_row_triggers('sync.conflict', array['status', 'resolved_by', 'resolved_at']);

alter table sync.operation enable row level security;
alter table sync.operation force row level security;
alter table sync.conflict enable row level security;
alter table sync.conflict force row level security;

create or replace function private.owns_operation(p_operation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from sync.operation as o where o.id = p_operation_id and o.user_account_id = auth.uid());
$$;
revoke execute on function private.owns_operation(uuid) from public, anon;
grant execute on function private.owns_operation(uuid) to authenticated, service_role;

revoke all on sync.operation, sync.conflict from public, anon, authenticated;
grant select on sync.operation to authenticated;
-- The device sees that its operation is in conflict, never the stored client values.
grant select (id, operation_id, entity_table, entity_id, fields, server_row_version, status, resolved_at,
  created_at, updated_at, row_version) on sync.conflict to authenticated;
grant select, insert, update on sync.operation, sync.conflict to service_role;

drop policy if exists operation_select on sync.operation;
create policy operation_select on sync.operation
  for select to authenticated
  using (user_account_id = (select auth.uid()));

drop policy if exists conflict_select on sync.conflict;
create policy conflict_select on sync.conflict
  for select to authenticated
  using (
    private.owns_operation(operation_id)
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );
