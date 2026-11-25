-- 0004_lock_rls_auto_enable: Supabase advisor 0028/0029 on the hosted projects.
--
-- Hosted projects created with the "automatic RLS" option contain `public.rls_auto_enable()`, a
-- SECURITY DEFINER event-trigger function (event trigger `ensure_rls`) granted EXECUTE to PUBLIC, anon
-- and authenticated, so it is listed as an RPC at /rest/v1/rpc/rls_auto_enable. Event triggers fire
-- regardless of EXECUTE grants, so revoking them keeps the trigger working and closes the RPC.
-- The function does not exist on a fresh local stack, hence the existence check.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
