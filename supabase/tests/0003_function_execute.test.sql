-- pgTAP: 0003_revoke_function_execute_globally — new functions are not executable unless granted.
-- Unlike the 0002 test, schemas here ARE usable by the API roles, so only function EXECUTE can block.
-- Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- The global default ACL for functions created by postgres grants nothing to PUBLIC
select ok(
  exists (select 1 from pg_default_acl
           where defaclrole = 'postgres'::regrole and defaclnamespace = 0 and defaclobjtype = 'f'),
  'a global default ACL for postgres functions exists'
);
select ok(
  not exists (select 1 from pg_default_acl d, aclexplode(d.defaclacl) a
               where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0
                 and d.defaclobjtype = 'f' and a.grantee = 0),
  'the global default ACL for postgres functions has no PUBLIC entry'
);

-- A schema outside the 13 domain schemas, open to the API roles: only the function ACL can deny
create schema tap_scratch;
grant usage on schema tap_scratch to anon, authenticated;
create function tap_scratch.f() returns int language sql as $f$ select 1 $f$;

select ok(not has_function_privilege('anon', 'tap_scratch.f()', 'EXECUTE'), 'anon cannot execute a new function (any schema)');
select ok(not has_function_privilege('authenticated', 'tap_scratch.f()', 'EXECUTE'), 'authenticated cannot execute a new function (any schema)');

set local role anon;
select throws_ok($$select tap_scratch.f()$$, '42501', null, 'calling it as anon is refused');
reset role;

-- Same in a domain schema once Phase 1 grants USAGE on it
grant usage on schema identity to anon, authenticated;
create function identity.tap_f() returns int language sql as $f$ select 1 $f$;
set local role authenticated;
select throws_ok($$select identity.tap_f()$$, '42501', null, 'authenticated cannot call an ungranted identity function');
reset role;

-- Allowed: an explicit grant works (the convention in supabase/CLAUDE.md)
grant execute on function identity.tap_f() to authenticated;
set local role authenticated;
select lives_ok($$select identity.tap_f()$$, 'authenticated can call it after grant execute');
reset role;
set local role anon;
select throws_ok($$select identity.tap_f()$$, '42501', null, 'the grant to authenticated does not open it to anon');
reset role;

-- public: functions, sequences
create function public.tap_f() returns int language sql as $f$ select 1 $f$;
create sequence public.tap_seq;
select ok(not has_function_privilege('authenticated', 'public.tap_f()', 'EXECUTE'), 'authenticated cannot execute a new public function');
select ok(not has_sequence_privilege('anon', 'public.tap_seq', 'USAGE'), 'anon has no USAGE on a new public sequence');
select ok(not has_sequence_privilege('authenticated', 'public.tap_seq', 'USAGE'), 'authenticated has no USAGE on a new public sequence');

select * from finish();
rollback;
