-- 0017_powersync_least_privilege_hardening: replaces 0016's private.restrict_powersync_roles() after the RLS audit
-- (Step 1.4 offline spike). 0016 is already applied on dev, so this fixes forward.
--
-- ACCEPTED RISK (spike, dev, synthetic data only — gate before staging, see offline-spike-report §3.5 and §5):
--   PowerSync's role keeps REPLICATION and BYPASSRLS. BYPASSRLS is needed for PowerSync's initial snapshot of the
--   three tables. REPLICATION is needed for logical replication, and it also lets whoever holds the role's password
--   create their own replication slot (e.g. test_decoding) and read the change stream of EVERY table, whatever
--   the grants or the publication say. Grants therefore limit snapshots, not the change stream: the real control
--   is the role's password, which lives only in PowerSync. Rotate it after the spike and disable the role when
--   the spike ends. Staging/production must not use this setup.
--
-- Changes from 0016 (audit findings):
--   - security invoker (only the migration and pg_cron, both as postgres, call it);
--   - role section runs before the publication section; every revoke runs in its own exception block, so one
--     failure is reported instead of stopping the rest;
--   - the three allowed tables are reset to SELECT only (no INSERT/UPDATE/DELETE/TRUNCATE/column grants);
--   - CREATE on schema community, column grants, default privileges, role memberships and database
--     CREATE/TEMP are revoked too;
--   - the publication is dropped and recreated only when p_allow_publication_drop (the one-time migration run);
--     the cron run never drops a live publication, it reports it;
--   - ends with a check: anything still wrong is returned in `violations` and raised as a WARNING, so drift
--     shows in cron.job_run_details;
--   - reports other non-Supabase roles holding REPLICATION or BYPASSRLS.

drop function if exists private.restrict_powersync_roles();

create or replace function private.restrict_powersync_roles(p_allow_publication_drop boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_allowed constant regclass[] := array[
    'community.catchment'::regclass, 'community.chw_assignment'::regclass, 'community.household'::regclass];
  v_allowed_names constant text[] := array['community.catchment', 'community.chw_assignment', 'community.household'];
  v_role record;
  v_obj record;
  v_current text[];
  v_roles text[] := '{}';
  v_errors text[] := '{}';
  v_violations text[] := '{}';
  v_other text[];
begin
  -- ── 1. Roles created by PowerSync's integration ─────────────────────────────────────────────────
  for v_role in
    select r.oid, r.rolname from pg_catalog.pg_roles as r
     where r.rolname like 'powersync\_%' and r.rolname <> 'powersync_role'
  loop
    v_roles := v_roles || v_role.rolname::text;

    -- Every table, view, sequence etc. with a table- or column-level grant to the role (allowed ones included:
    -- they are reset to SELECT below). Revoking table privileges also revokes column privileges.
    for v_obj in
      select distinct c.oid::regclass::text as name, c.relkind
        from pg_catalog.pg_class as c
       where exists (select 1 from pg_catalog.aclexplode(c.relacl) as a where a.grantee = v_role.oid)
          or exists (select 1 from pg_catalog.pg_attribute as att
                       cross join lateral pg_catalog.aclexplode(att.attacl) as a
                      where att.attrelid = c.oid and a.grantee = v_role.oid)
    loop
      begin
        execute format('revoke all on %s %s from %I',
          case when v_obj.relkind = 'S' then 'sequence' else 'table' end, v_obj.name, v_role.rolname);
      exception when others then
        v_errors := v_errors || format('revoke on %s: %s', v_obj.name, sqlerrm);
      end;
    end loop;

    for v_obj in
      select distinct p.oid::regprocedure::text as name
        from pg_catalog.pg_proc as p cross join lateral pg_catalog.aclexplode(p.proacl) as a
       where a.grantee = v_role.oid
    loop
      begin
        execute format('revoke all on function %s from %I', v_obj.name, v_role.rolname);
      exception when others then
        v_errors := v_errors || format('revoke on function %s: %s', v_obj.name, sqlerrm);
      end;
    end loop;

    -- All schemas, community included (drops CREATE; USAGE is granted back below).
    for v_obj in
      select distinct n.nspname
        from pg_catalog.pg_namespace as n cross join lateral pg_catalog.aclexplode(n.nspacl) as a
       where a.grantee = v_role.oid
    loop
      begin
        execute format('revoke all on schema %I from %I', v_obj.nspname, v_role.rolname);
      exception when others then
        v_errors := v_errors || format('revoke on schema %s: %s', v_obj.nspname, sqlerrm);
      end;
    end loop;

    -- Default privileges that would grant the role access to future objects.
    for v_obj in
      select d.defaclrole::regrole::text as owner, d.defaclnamespace, d.defaclobjtype
        from pg_catalog.pg_default_acl as d cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
       where a.grantee = v_role.oid
    loop
      begin
        execute format('alter default privileges for role %s %s revoke all on %s from %I',
          v_obj.owner,
          case when v_obj.defaclnamespace = 0 then ''
               else format('in schema %I', v_obj.defaclnamespace::regnamespace::text) end,
          case v_obj.defaclobjtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions'
               when 'T' then 'types' when 'n' then 'schemas' end,
          v_role.rolname);
      exception when others then
        v_errors := v_errors || format('default privileges of %s: %s', v_obj.owner, sqlerrm);
      end;
    end loop;

    -- Memberships in other roles (pg_read_all_data, pg_write_all_data, service_role, postgres, …).
    for v_obj in
      select m.roleid::regrole::text as granted
        from pg_catalog.pg_auth_members as m where m.member = v_role.oid
    loop
      begin
        execute format('revoke %s from %I', v_obj.granted, v_role.rolname);
      exception when others then
        v_errors := v_errors || format('revoke membership %s: %s', v_obj.granted, sqlerrm);
      end;
    end loop;

    begin
      execute format('revoke create, temporary on database %I from %I', pg_catalog.current_database(), v_role.rolname);
      execute format('grant usage on schema community to %I', v_role.rolname);
      execute format('grant select on community.household, community.catchment, community.chw_assignment to %I',
        v_role.rolname);
      execute format('alter role %I connection limit 5', v_role.rolname);
    exception when others then
      v_errors := v_errors || format('baseline grants for %s: %s', v_role.rolname, sqlerrm);
    end;
  end loop;

  -- ── 2. Publication: exactly the three spike tables ──────────────────────────────────────────────
  begin
    if exists (select 1 from pg_catalog.pg_publication where pubname = 'powersync' and puballtables) then
      if p_allow_publication_drop then
        drop publication powersync;
      else
        v_violations := v_violations || 'publication powersync is FOR ALL TABLES (not dropped outside a migration)'::text;
      end if;
    end if;
    if not exists (select 1 from pg_catalog.pg_publication where pubname = 'powersync') then
      create publication powersync for table community.household, community.catchment, community.chw_assignment;
    elsif not exists (select 1 from pg_catalog.pg_publication where pubname = 'powersync' and puballtables) then
      select coalesce(array_agg(t.schemaname || '.' || t.tablename order by 1), '{}')
        into v_current from pg_catalog.pg_publication_tables as t where t.pubname = 'powersync';
      if v_current is distinct from v_allowed_names then
        alter publication powersync set table community.household, community.catchment, community.chw_assignment;
      end if;
    end if;
  exception when others then
    v_errors := v_errors || format('publication: %s', sqlerrm);
  end;

  -- ── 3. Final check: anything explicit still granted outside the allowed set ────────────────────
  for v_role in
    select r.oid, r.rolname from pg_catalog.pg_roles as r
     where r.rolname like 'powersync\_%' and r.rolname <> 'powersync_role'
  loop
    select v_violations || coalesce(array_agg(distinct format('%s: %s on %s', v_role.rolname, a.privilege_type, c.oid::regclass)), '{}')
      into v_violations
      from pg_catalog.pg_class as c cross join lateral pg_catalog.aclexplode(c.relacl) as a
     where a.grantee = v_role.oid and (c.oid <> all (v_allowed) or a.privilege_type <> 'SELECT');
    select v_violations || coalesce(array_agg(distinct format('%s: column grant on %s', v_role.rolname, att.attrelid::regclass)), '{}')
      into v_violations
      from pg_catalog.pg_attribute as att cross join lateral pg_catalog.aclexplode(att.attacl) as a
     where a.grantee = v_role.oid;
    select v_violations || coalesce(array_agg(distinct format('%s: %s on schema %s', v_role.rolname, a.privilege_type, n.nspname)), '{}')
      into v_violations
      from pg_catalog.pg_namespace as n cross join lateral pg_catalog.aclexplode(n.nspacl) as a
     where a.grantee = v_role.oid and (n.nspname <> 'community' or a.privilege_type <> 'USAGE');
    select v_violations || coalesce(array_agg(distinct format('%s: function %s', v_role.rolname, p.oid::regprocedure)), '{}')
      into v_violations
      from pg_catalog.pg_proc as p cross join lateral pg_catalog.aclexplode(p.proacl) as a
     where a.grantee = v_role.oid;
    select v_violations || coalesce(array_agg(format('%s: member of %s', v_role.rolname, m.roleid::regrole)), '{}')
      into v_violations
      from pg_catalog.pg_auth_members as m where m.member = v_role.oid;
    select v_violations || coalesce(array_agg(format('%s: default privileges of %s', v_role.rolname, d.defaclrole::regrole)), '{}')
      into v_violations
      from pg_catalog.pg_default_acl as d cross join lateral pg_catalog.aclexplode(d.defaclacl) as a
     where a.grantee = v_role.oid;
    if pg_catalog.has_database_privilege(v_role.oid, pg_catalog.current_database(), 'CREATE') then
      v_violations := v_violations || format('%s: CREATE on database', v_role.rolname);
    end if;
  end loop;

  -- Roles outside Supabase's own and ours that can read past RLS or the change stream.
  select coalesce(array_agg(r.rolname::text order by 1), '{}') into v_other
    from pg_catalog.pg_roles as r
   where (r.rolreplication or r.rolbypassrls)
     and r.rolname not like 'supabase\_%' and r.rolname not like 'powersync\_%'
     and r.rolname not in ('postgres', 'service_role', 'dashboard_user', 'authenticator', 'powersync_role');

  v_violations := v_violations || v_errors;
  if cardinality(v_violations) > 0 then
    raise warning 'restrict_powersync_roles: % problem(s): %', cardinality(v_violations), array_to_string(v_violations, '; ');
  end if;

  return jsonb_build_object('roles', to_jsonb(v_roles), 'violations', to_jsonb(v_violations),
                            'other_privileged_roles', to_jsonb(v_other));
end;
$$;
revoke execute on function private.restrict_powersync_roles(boolean) from public, anon, authenticated, service_role;

-- One-time run: the migration may replace a FOR ALL TABLES publication; it fails if anything is left over.
do $$
declare
  v_result jsonb := private.restrict_powersync_roles(true);
begin
  if jsonb_array_length(v_result -> 'violations') > 0 then
    raise exception 'restrict_powersync_roles left problems: %', v_result -> 'violations';
  end if;
end;
$$;

-- Drift guard: same job name as 0016, so this replaces its command. Never drops the publication.
select cron.schedule('restrict-powersync-roles', '*/30 * * * *',
  $$select private.restrict_powersync_roles(false)$$);
