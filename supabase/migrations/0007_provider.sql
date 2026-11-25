-- 0007_provider: organizations, locations, services, practitioners, credentials, practitioner roles.
-- Design: docs/design/erd.md §3 (provider.*) and §4. Step 1.2.
-- Directory rows (active and verified) are readable by any signed-in user (erd.md §4 "public directory view");
-- unverified, suspended or inactive rows and all credentials are not.

create table if not exists provider.organization (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'hospital', 'health_centre', 'clinic', 'laboratory', 'pharmacy', 'community_programme', 'platform')),
  name text not null check (char_length(name) between 2 and 200),
  part_of_id uuid references provider.organization (id),
  licence_number text check (char_length(licence_number) <= 100),
  licence_evidence_path text check (char_length(licence_evidence_path) <= 500),
  verification_status text not null default 'submitted'
    check (verification_status in ('submitted', 'under_review', 'verified', 'rejected')),
  verified_by uuid references identity.user_account (id),
  verified_at timestamptz,
  status text not null default 'inactive' check (status in ('active', 'suspended', 'inactive')),
  phone text check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  email text check (char_length(email) <= 254 and email like '%@%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint organization_verified_consistent check (
    (verification_status = 'verified') = (verified_at is not null and verified_by is not null))
);

alter table identity.membership
  drop constraint if exists membership_organization_fk;
alter table identity.membership
  add constraint membership_organization_fk foreign key (organization_id) references provider.organization (id);

create table if not exists provider.location (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references provider.organization (id),
  name text not null check (char_length(name) between 2 and 200),
  address_text text check (char_length(address_text) <= 300),
  region text check (char_length(region) <= 100),
  department text check (char_length(department) <= 100),
  district text check (char_length(district) <= 100),
  position extensions.geography(point, 4326),
  position_source text check (char_length(position_source) <= 100),
  opening_hours jsonb,
  opening_hours_updated_at timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint location_hours_dated check (opening_hours is null or opening_hours_updated_at is not null)
);
create index if not exists location_org_idx on provider.location (organization_id);
create index if not exists location_position_gix on provider.location using gist (position);

create table if not exists provider.healthcare_service (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references provider.organization (id),
  location_id uuid references provider.location (id),
  category text not null check (char_length(category) between 2 and 100),
  specialty_code text check (char_length(specialty_code) <= 50),
  channels text[] not null default '{in_person}'
    check (channels <@ array['in_person', 'video', 'audio', 'chat']::text[] and cardinality(channels) > 0),
  price_xaf integer check (price_xaf >= 0),
  price_source text check (char_length(price_source) <= 200),
  price_updated_at timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  -- RULE-08 / RULE-11: a price is always shown with its source and last-updated time.
  constraint service_price_sourced check (
    price_xaf is null or (price_source is not null and price_updated_at is not null))
);
create index if not exists service_org_idx on provider.healthcare_service (organization_id);

create table if not exists provider.practitioner (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null unique references identity.person (id),
  display_name text not null check (char_length(display_name) between 2 and 200),
  verification_status text not null default 'submitted'
    check (verification_status in ('submitted', 'under_review', 'verified', 'rejected')),
  status text not null default 'inactive' check (status in ('active', 'suspended', 'expired', 'inactive')),
  next_reverification_due date,
  suspension_reason text check (char_length(suspension_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  -- RULE-01: only verified practitioners can be active.
  constraint practitioner_active_verified check (status <> 'active' or verification_status = 'verified')
);
comment on column provider.practitioner.display_name is
  'Public directory name, so the directory never needs to expose identity.person.';

create table if not exists provider.credential (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references provider.practitioner (id),
  kind text not null check (kind in ('registration', 'licence', 'qualification', 'specialty')),
  issuer text not null check (char_length(issuer) between 2 and 200),
  number text check (char_length(number) <= 100),
  specialty_code text check (char_length(specialty_code) <= 50),
  issued_on date,
  expires_on date,
  evidence_object_path text check (char_length(evidence_object_path) <= 500),
  verification_status text not null default 'submitted'
    check (verification_status in ('submitted', 'under_review', 'verified', 'rejected', 'expired')),
  verification_source text check (char_length(verification_source) <= 300),
  verified_by uuid references identity.user_account (id),
  verified_at timestamptz,
  next_review_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint credential_dates check (expires_on is null or issued_on is null or expires_on > issued_on)
);
create index if not exists credential_practitioner_idx on provider.credential (practitioner_id);

create table if not exists provider.practitioner_role (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references provider.practitioner (id),
  organization_id uuid not null references provider.organization (id),
  location_id uuid references provider.location (id),
  role_code text not null check (char_length(role_code) between 2 and 50),
  specialty_code text check (char_length(specialty_code) <= 50),
  permitted_service_categories text[] not null default '{}',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  status text not null default 'active' check (status in ('active', 'suspended', 'ended')),
  approved_by uuid references identity.user_account (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references identity.user_account (id),
  client_created_at timestamptz,
  row_version integer not null default 1,
  constraint practitioner_role_validity check (valid_to is null or valid_to >= valid_from)
);
create index if not exists practitioner_role_practitioner_idx on provider.practitioner_role (practitioner_id);
create index if not exists practitioner_role_org_idx on provider.practitioner_role (organization_id);

select private.add_row_triggers('provider.organization');
select private.add_row_triggers('provider.location');
select private.add_row_triggers('provider.healthcare_service');
select private.add_row_triggers('provider.practitioner');
select private.add_row_triggers('provider.credential');
select private.add_row_triggers('provider.practitioner_role');

alter table provider.organization enable row level security;
alter table provider.organization force row level security;
alter table provider.location enable row level security;
alter table provider.location force row level security;
alter table provider.healthcare_service enable row level security;
alter table provider.healthcare_service force row level security;
alter table provider.practitioner enable row level security;
alter table provider.practitioner force row level security;
alter table provider.credential enable row level security;
alter table provider.credential force row level security;
alter table provider.practitioner_role enable row level security;
alter table provider.practitioner_role force row level security;

-- ── Predicates ──────────────────────────────────────────────────────────────────────────────────

create or replace function private.org_listed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from provider.organization as o
    where o.id = p_organization_id and o.status = 'active' and o.verification_status = 'verified'
  );
$$;

create or replace function private.is_own_practitioner(p_practitioner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from provider.practitioner as pr
    join identity.person as pe on pe.id = pr.person_id
    where pr.id = p_practitioner_id and pe.user_account_id = auth.uid()
  );
$$;

-- Facility admin (MFA) of an organization in which the practitioner holds a role.
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
      and identity.has_role('facility_admin', r.organization_id)
  );
$$;

revoke execute on function private.org_listed(uuid), private.is_own_practitioner(uuid),
  private.admins_practitioner(uuid) from public, anon;
grant execute on function private.org_listed(uuid), private.is_own_practitioner(uuid),
  private.admins_practitioner(uuid) to authenticated, service_role;

-- ── Privileges ──────────────────────────────────────────────────────────────────────────────────

revoke all on provider.organization, provider.location, provider.healthcare_service, provider.practitioner,
  provider.credential, provider.practitioner_role from public, anon, authenticated;
grant select on provider.organization, provider.location, provider.healthcare_service, provider.practitioner,
  provider.credential, provider.practitioner_role to authenticated;
grant select, insert, update on provider.organization, provider.location, provider.healthcare_service,
  provider.practitioner, provider.credential, provider.practitioner_role to service_role;

-- ── Policies ────────────────────────────────────────────────────────────────────────────────────

drop policy if exists organization_select on provider.organization;
create policy organization_select on provider.organization
  for select to authenticated
  using (
    (status = 'active' and verification_status = 'verified')
    or identity.in_org(id)
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );

drop policy if exists location_select on provider.location;
create policy location_select on provider.location
  for select to authenticated
  using (
    (status = 'active' and private.org_listed(organization_id))
    or identity.in_org(organization_id)
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );

drop policy if exists healthcare_service_select on provider.healthcare_service;
create policy healthcare_service_select on provider.healthcare_service
  for select to authenticated
  using (
    (status = 'active' and private.org_listed(organization_id))
    or identity.in_org(organization_id)
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );

drop policy if exists practitioner_select on provider.practitioner;
create policy practitioner_select on provider.practitioner
  for select to authenticated
  using (
    (status = 'active' and verification_status = 'verified')
    or private.is_own_practitioner(id)
    or private.admins_practitioner(id)
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );

-- Credentials are never part of the public directory (erd.md: SERVER_ONLY; badge only).
drop policy if exists credential_select on provider.credential;
create policy credential_select on provider.credential
  for select to authenticated
  using (
    private.is_own_practitioner(practitioner_id)
    or private.admins_practitioner(practitioner_id)
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );

drop policy if exists practitioner_role_select on provider.practitioner_role;
create policy practitioner_role_select on provider.practitioner_role
  for select to authenticated
  using (
    (status = 'active' and private.org_listed(organization_id))
    or private.is_own_practitioner(practitioner_id)
    or ((select identity.aal2()) and identity.has_role('facility_admin', organization_id))
    or ((select identity.has_role('platform_admin')) and (select identity.aal2()))
  );
