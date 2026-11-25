-- 0005_foundation_common: schemas and shared row triggers for the foundation (Step 1.2, docs/design/erd.md §1).
--
-- api      Write API. SECURITY DEFINER functions are the only way clients change identity-critical and
--          clinical rows. Exposed through the Data API (RPC).
-- private  Trigger functions and access predicates used inside RLS policies. NOT exposed through the
--          Data API; `authenticated` gets USAGE only so policies can call the predicates granted to it.

create schema if not exists api;
comment on schema api is 'Write API: SECURITY DEFINER functions that check role, organization, care relationship and consent (Step 1.2).';

create schema if not exists private;
comment on schema private is 'Internal trigger functions and RLS predicates. Never exposed through the Data API; holds no tables.';

revoke all on schema api from public, anon;
revoke all on schema private from public, anon;
grant usage on schema api to authenticated, service_role;
grant usage on schema private to authenticated, service_role;

-- Domain schemas are read through RLS; table privileges are granted per table in each domain migration.
grant usage on schema identity, patient, provider, clinical, community, audit, sync to authenticated, service_role;

-- Standard columns (erd.md §1.1): server time is authoritative; client_created_at is device-reported metadata
-- and can never become created_at / updated_at; created_by comes from the JWT when there is one.
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

-- Append-only / restricted-update tables: only the listed columns may change (trigger arguments).
create or replace function private.guard_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_mutable text[] := coalesce(tg_argv::text[], '{}'::text[]) || array['updated_at', 'row_version'];
begin
  if (to_jsonb(new) - v_mutable) is distinct from (to_jsonb(old) - v_mutable) then
    raise exception 'only [%] may change on %.% (append-only, RULE-04)',
      array_to_string(coalesce(tg_argv::text[], '{}'::text[]), ', '), tg_table_schema, tg_table_name
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- No hard deletes anywhere in the foundation (erd.md §1.2): rows end through status and validity dates.
create or replace function private.forbid_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'rows in %.% are never deleted; end them with status / validity (RULE-04)',
    tg_table_schema, tg_table_name using errcode = '42501';
end;
$$;

-- Attaches the standard triggers to a table. p_mutable = null: no update guard;
-- p_mutable = '{}': nothing may change (fully append-only); otherwise only the listed columns may change.
create or replace function private.add_row_triggers(p_table regclass, p_mutable text[] default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create or replace trigger a_stamp_row before insert or update on %s for each row execute function private.stamp_row()',
    p_table);
  execute format(
    'create or replace trigger z_forbid_delete before delete on %s for each row execute function private.forbid_delete()',
    p_table);
  if p_mutable is not null then
    execute format(
      'create or replace trigger b_guard_immutable before update on %s for each row execute function private.guard_immutable(%s)',
      p_table, coalesce((select string_agg(quote_literal(c), ', ') from unnest(p_mutable) as c), ''));
  end if;
end;
$$;
