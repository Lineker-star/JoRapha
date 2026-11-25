-- 0010_community: catchments, CHW assignments, households and household members.
-- Design: docs/design/erd.md §3 (community.*) and §4 (CHW visibility). Step 1.2.
-- Only the parts needed for access control; the CHW module (Phase 4) extends them.

create table if not exists community.catchment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references provider.organization (id),
  name text not null check (char_length(name) between 2 and 200),
  area extensions.geography(multipolygon, 4326),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1
);
create index if not exists catchment_org_idx on community.catchment (organization_id);
create index if not exists catchment_area_gix on community.catchment using gist (area);

create table if not exists community.chw_assignment (
  id uuid primary key default gen_random_uuid(),
  user_account_id uuid not null references identity.user_account (id),
  catchment_id uuid not null references community.catchment (id),
  supervisor_user_id uuid references identity.user_account (id),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint chw_assignment_validity check (valid_to is null or valid_to >= valid_from),
  constraint chw_assignment_not_self_supervised check (supervisor_user_id is distinct from user_account_id)
);
create index if not exists chw_assignment_user_idx on community.chw_assignment (user_account_id) where status = 'active';
create index if not exists chw_assignment_catchment_idx on community.chw_assignment (catchment_id) where status = 'active';

create table if not exists community.household (
  id uuid primary key default gen_random_uuid(), -- client-generated when registered offline
  catchment_id uuid not null references community.catchment (id),
  name_or_head text check (char_length(name_or_head) <= 200),
  village text check (char_length(village) <= 150),
  position extensions.geography(point, 4326),
  status text not null default 'active' check (status in ('active', 'inactive', 'entered_in_error')),
  origin_device_id uuid references identity.device_registration (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1
);
create index if not exists household_catchment_idx on community.household (catchment_id);

create table if not exists community.household_member (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references community.household (id),
  patient_id uuid not null references patient.patient (id),
  relationship_to_head text check (char_length(relationship_to_head) <= 50),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  origin_device_id uuid references identity.device_registration (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint household_member_validity check (valid_to is null or valid_to >= valid_from)
);
create index if not exists household_member_household_idx on community.household_member (household_id);
create index if not exists household_member_patient_idx on community.household_member (patient_id);

select private.add_row_triggers('community.catchment');
select private.add_row_triggers('community.chw_assignment', array['status', 'valid_to']);
select private.add_row_triggers('community.household');
select private.add_row_triggers('community.household_member', array['valid_to']);

alter table community.catchment enable row level security;
alter table community.catchment force row level security;
alter table community.chw_assignment enable row level security;
alter table community.chw_assignment force row level security;
alter table community.household enable row level security;
alter table community.household force row level security;
alter table community.household_member enable row level security;
alter table community.household_member force row level security;

-- Caller is an active CHW assigned to the catchment, or the active supervisor of such an assignment.
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
    where a.catchment_id = p_catchment_id
      and c.status = 'active'
      and a.status = 'active' and a.valid_from <= now() and (a.valid_to is null or a.valid_to > now())
      and (
        (a.user_account_id = auth.uid() and identity.has_role('chw', c.organization_id))
        or (a.supervisor_user_id = auth.uid() and identity.has_role('chw_supervisor', c.organization_id))
      )
  );
$$;

create or replace function private.admins_catchment(p_catchment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select identity.aal2() and exists (
    select 1 from community.catchment as c
    where c.id = p_catchment_id and identity.has_role('facility_admin', c.organization_id)
  );
$$;

create or replace function private.household_of_self_or_dependant(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from community.household_member as hm
    where hm.household_id = p_household_id
      and (hm.valid_to is null or hm.valid_to > now())
      and (private.is_self_patient(hm.patient_id) or private.is_caregiver_of(hm.patient_id, 'view_record'))
  );
$$;

create or replace function private.household_catchment(p_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.catchment_id from community.household as h where h.id = p_household_id;
$$;

revoke execute on function private.covers_catchment(uuid), private.admins_catchment(uuid),
  private.household_of_self_or_dependant(uuid), private.household_catchment(uuid) from public, anon;
grant execute on function private.covers_catchment(uuid), private.admins_catchment(uuid),
  private.household_of_self_or_dependant(uuid), private.household_catchment(uuid) to authenticated, service_role;

revoke all on community.catchment, community.chw_assignment, community.household, community.household_member
  from public, anon, authenticated;
grant select on community.catchment, community.chw_assignment, community.household, community.household_member
  to authenticated;
grant select, insert, update on community.catchment, community.chw_assignment, community.household,
  community.household_member to service_role;

drop policy if exists catchment_select on community.catchment;
create policy catchment_select on community.catchment
  for select to authenticated
  using (private.covers_catchment(id) or private.admins_catchment(id));

drop policy if exists chw_assignment_select on community.chw_assignment;
create policy chw_assignment_select on community.chw_assignment
  for select to authenticated
  using (
    user_account_id = (select auth.uid())
    or supervisor_user_id = (select auth.uid())
    or private.admins_catchment(catchment_id)
  );

drop policy if exists household_select on community.household;
create policy household_select on community.household
  for select to authenticated
  using (private.covers_catchment(catchment_id) or private.household_of_self_or_dependant(id));

drop policy if exists household_member_select on community.household_member;
create policy household_member_select on community.household_member
  for select to authenticated
  using (
    private.covers_catchment(private.household_catchment(household_id))
    or private.is_self_patient(patient_id)
    or private.is_caregiver_of(patient_id, 'view_record')
  );
