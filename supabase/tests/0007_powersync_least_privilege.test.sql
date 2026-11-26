-- pgTAP: private.restrict_powersync_roles (migrations 0016, 0017) — PowerSync keeps access to the three spike
-- tables only. Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
-- Not covered: a FOR ALL TABLES publication (creating one needs superuser, which postgres is not on Supabase).
begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

-- ── Simulate what PowerSync's Supabase integration does, plus every other access path ───────────
create role powersync_tapfake with nologin replication bypassrls;
create sequence community.tap_seq;
grant usage, create on schema patient, clinical, audit, community to powersync_tapfake;
grant select on patient.patient, clinical.care_relationship, audit.audit_event, community.household_member
  to powersync_tapfake;
grant select, insert, update, delete, truncate on community.household to powersync_tapfake;
grant select (id) on identity.person to powersync_tapfake;
grant usage on sequence community.tap_seq to powersync_tapfake;
grant execute on function private.end_expired_chw_assignments() to powersync_tapfake;
grant pg_read_all_data to powersync_tapfake;
alter default privileges in schema patient grant select on tables to powersync_tapfake;
do $$ begin execute format('grant create on database %I to powersync_tapfake', current_database()); end $$;
alter publication powersync add table patient.patient, community.household_member;

create temporary table tap_result on commit drop as
  select private.restrict_powersync_roles(false) as r;

select ok((select (r -> 'roles') ? 'powersync_tapfake' from tap_result), 'the function finds the integration role');
select is((select jsonb_array_length(r -> 'violations') from tap_result), 0, 'no violations are left');

-- Publication back to exactly the three spike tables.
select is(
  (select array_agg(schemaname || '.' || tablename order by 1) from pg_publication_tables where pubname = 'powersync'),
  array['community.catchment', 'community.chw_assignment', 'community.household']::text[],
  'publication powersync lists exactly household, catchment and chw_assignment');

-- Denied: everything outside SELECT on the three tables.
select is(has_table_privilege('powersync_tapfake', 'patient.patient', 'select'), false, 'no SELECT on patient.patient');
select is(has_table_privilege('powersync_tapfake', 'clinical.care_relationship', 'select'), false, 'no SELECT on clinical');
select is(has_table_privilege('powersync_tapfake', 'audit.audit_event', 'select'), false, 'no SELECT on audit');
select is(has_table_privilege('powersync_tapfake', 'community.household_member', 'select'), false,
  'no SELECT on household_member');
select is(has_column_privilege('powersync_tapfake', 'identity.person', 'id', 'select'), false, 'column grant revoked');
select is(has_table_privilege('powersync_tapfake', 'community.household', 'insert'), false, 'no INSERT on household');
select is(has_table_privilege('powersync_tapfake', 'community.household', 'truncate'), false, 'no TRUNCATE on household');
select is(has_sequence_privilege('powersync_tapfake', 'community.tap_seq', 'usage'), false, 'sequence grant revoked');
select is(has_function_privilege('powersync_tapfake', 'private.end_expired_chw_assignments()', 'execute'), false,
  'function grant revoked');
select is(has_schema_privilege('powersync_tapfake', 'patient', 'usage'), false, 'no USAGE on schema patient');
select is(has_schema_privilege('powersync_tapfake', 'community', 'create'), false, 'no CREATE on schema community');
select is(pg_has_role('powersync_tapfake', 'pg_read_all_data', 'member'), false, 'pg_read_all_data membership revoked');
select is(has_database_privilege('powersync_tapfake', current_database(), 'create'), false, 'no CREATE on the database');
select is(
  (select count(*)::integer from pg_default_acl as d cross join lateral aclexplode(d.defaclacl) as a
    where a.grantee = 'powersync_tapfake'::regrole), 0, 'default privileges revoked');

-- Allowed: the three spike tables, read only.
select is(has_table_privilege('powersync_tapfake', 'community.household', 'select'), true, 'SELECT on household kept');
select is(has_table_privilege('powersync_tapfake', 'community.catchment', 'select'), true, 'SELECT on catchment');
select is(has_table_privilege('powersync_tapfake', 'community.chw_assignment', 'select'), true,
  'SELECT on chw_assignment');
select is(has_schema_privilege('powersync_tapfake', 'community', 'usage'), true, 'USAGE on schema community');
select is((select rolconnlimit from pg_roles where rolname = 'powersync_tapfake'), 5, 'connections capped at 5');

-- Idempotent: a second run changes nothing and reports nothing.
select is(jsonb_array_length(private.restrict_powersync_roles(false) -> 'violations'), 0, 'second run is clean');

-- The managed role is left as 0015 defined it; API roles cannot call the function.
select is(has_table_privilege('powersync_role', 'patient.patient', 'select'), false,
  'powersync_role has no SELECT on patient.patient');
select is(has_function_privilege('anon', 'private.restrict_powersync_roles(boolean)', 'execute'), false,
  'anon cannot execute restrict_powersync_roles');
select is(has_function_privilege('authenticated', 'private.restrict_powersync_roles(boolean)', 'execute'), false,
  'authenticated cannot execute restrict_powersync_roles');
select is(has_function_privilege('service_role', 'private.restrict_powersync_roles(boolean)', 'execute'), false,
  'service_role cannot execute restrict_powersync_roles');

select * from finish();
rollback;
