-- 0003_revoke_function_execute_globally: fix for 0002.
--
-- Postgres grants EXECUTE on new functions to PUBLIC through a *global* default. Per-schema
-- `alter default privileges ... in schema` entries (0002) can only add to the global defaults, never
-- remove from them (PostgreSQL docs, ALTER DEFAULT PRIVILEGES), so 0002 left new functions executable
-- by anon/authenticated via PUBLIC. Revoke the global default for functions created by `postgres`
-- (the migration role). Supabase's own functions are owned by other roles and are not affected.
-- From now on every function needs an explicit `grant execute ... to <role>` (supabase/CLAUDE.md).

alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres revoke execute on functions from anon, authenticated;
