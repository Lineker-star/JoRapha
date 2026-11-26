-- 0016_powersync_least_privilege: Step 1.4 offline spike — keep PowerSync's database access to the three
-- spike tables, whatever PowerSync's Supabase integration set up.
--
-- Why: on dev, PowerSync's dashboard integration created its own login role (powersync_<id>) with BYPASSRLS,
-- SELECT on every table (patient, clinical, audit included) and a `powersync` publication listing every table.
-- The publication existed before 0015 ran, so 0015's three-table publication was skipped. Owner decision
-- (2026-11-26): restrict that role in place rather than switching PowerSync to powersync_role.
--
-- private.restrict_powersync_roles():
--   1. sets the `powersync` publication to exactly household, catchment and chw_assignment;
--   2. for every role named powersync_* other than powersync_role: revokes every explicit privilege outside
--      the allowed set (tables, views, sequences, functions, schemas, pg_read_all_data), keeps
--      USAGE on community + SELECT on the three tables, and caps connections at 5.
-- It runs now and every 30 minutes (drift guard: the integration may re-grant when reconfigured).
-- Tested by supabase/tests/0007_powersync_least_privilege.test.sql.

create or replace function private.restrict_powersync_roles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed constant text[] := array['community.catchment', 'community.chw_assignment', 'community.household'];
  v_current text[];
  v_role record;
  v_obj record;
  v_count integer := 0;
begin
  -- 1. Publication: exactly the three spike tables.
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'powersync' and puballtables) then
    drop publication powersync;
  end if;
  if not exists (select 1 from pg_catalog.pg_publication where pubname = 'powersync') then
    create publication powersync for table community.household, community.catchment, community.chw_assignment;
  else
    select coalesce(array_agg(t.schemaname || '.' || t.tablename order by 1), '{}')
      into v_current
      from pg_catalog.pg_publication_tables as t
     where t.pubname = 'powersync';
    if v_current is distinct from v_allowed then
      alter publication powersync set table community.household, community.catchment, community.chw_assignment;
    end if;
  end if;

  -- 2. Roles created by PowerSync's integration.
  for v_role in
    select r.oid, r.rolname from pg_catalog.pg_roles as r
     where r.rolname like 'powersync\_%' and r.rolname <> 'powersync_role'
  loop
    v_count := v_count + 1;

    -- Tables, views, materialized views, foreign tables and sequences outside the allowed set.
    for v_obj in
      select distinct c.oid::regclass::text as name, c.relkind
        from pg_catalog.pg_class as c
             cross join lateral pg_catalog.aclexplode(c.relacl) as a
       where a.grantee = v_role.oid
         and (c.relnamespace::regnamespace::text || '.' || c.relname) <> all (v_allowed)
    loop
      execute format('revoke all on %s %s from %I',
        case when v_obj.relkind = 'S' then 'sequence' else 'table' end, v_obj.name, v_role.rolname);
    end loop;

    -- Explicit function grants.
    for v_obj in
      select distinct p.oid::regprocedure::text as name
        from pg_catalog.pg_proc as p
             cross join lateral pg_catalog.aclexplode(p.proacl) as a
       where a.grantee = v_role.oid
    loop
      execute format('revoke all on function %s from %I', v_obj.name, v_role.rolname);
    end loop;

    -- Schemas other than community.
    for v_obj in
      select distinct n.nspname
        from pg_catalog.pg_namespace as n
             cross join lateral pg_catalog.aclexplode(n.nspacl) as a
       where a.grantee = v_role.oid and n.nspname <> 'community'
    loop
      execute format('revoke all on schema %I from %I', v_obj.nspname, v_role.rolname);
    end loop;

    -- Predefined read-everything roles.
    if pg_catalog.pg_has_role(v_role.oid, 'pg_read_all_data', 'member') then
      execute format('revoke pg_read_all_data from %I', v_role.rolname);
    end if;

    execute format('grant usage on schema community to %I', v_role.rolname);
    execute format('grant select on community.household, community.catchment, community.chw_assignment to %I',
      v_role.rolname);
    execute format('alter role %I connection limit 5', v_role.rolname);
  end loop;

  return v_count;
end;
$$;
revoke execute on function private.restrict_powersync_roles() from public, anon, authenticated;

select private.restrict_powersync_roles();

select cron.schedule('restrict-powersync-roles', '*/30 * * * *',
  $$select private.restrict_powersync_roles()$$);
