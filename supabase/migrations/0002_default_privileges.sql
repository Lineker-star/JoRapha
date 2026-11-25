-- 0002_default_privileges: close the default grants that would apply to future objects.
--
-- 1. Postgres grants EXECUTE on every new function to PUBLIC by default. Once a domain schema is
--    granted USAGE (Phase 1), every function in it would become callable by anon/authenticated,
--    including SECURITY DEFINER ones. Revoke that default in each domain schema; functions are then
--    granted explicitly, per function, to the roles that need them.
-- 2. Supabase's default privileges give anon/authenticated full access to new tables, sequences and
--    functions created in `public`. JoRapha keeps no application objects in `public` (supabase/CLAUDE.md);
--    revoking the default means a table created there by mistake is not reachable through the API.
--
-- Applies to objects created by role `postgres` (the role migrations run as). Existing objects unchanged.

do $$
declare
  s text;
begin
  foreach s in array array[
    'identity', 'patient', 'provider', 'scheduling', 'clinical', 'referral', 'lab',
    'pharmacy', 'community', 'billing', 'content', 'audit', 'sync'
  ]
  loop
    execute format(
      'alter default privileges for role postgres in schema %I revoke execute on functions from public, anon, authenticated',
      s
    );
  end loop;
end
$$;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
