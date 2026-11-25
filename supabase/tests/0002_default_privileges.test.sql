-- pgTAP: default privileges from 0002_default_privileges.sql, proven by acting as the API roles.
-- Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- Probe objects created as postgres (like a migration would), rolled back at the end.
do $$
declare
  s text;
begin
  foreach s in array array[
    'identity', 'patient', 'provider', 'scheduling', 'clinical', 'referral', 'lab',
    'pharmacy', 'community', 'billing', 'content', 'audit', 'sync'
  ]
  loop
    execute format('create function %I.tap_probe() returns int language sql as $f$ select 1 $f$', s);
  end loop;
end
$$;
create table public.tap_probe (id int);
create function public.tap_probe() returns int language sql as $f$ select 1 $f$;

-- Denied: new functions in domain schemas are not executable by the API roles
select is(
  (select count(*)::int
     from unnest(array['identity','patient','provider','scheduling','clinical','referral','lab',
                       'pharmacy','community','billing','content','audit','sync']) as s
    where has_function_privilege('anon', format('%I.tap_probe()', s), 'EXECUTE')
       or has_function_privilege('authenticated', format('%I.tap_probe()', s), 'EXECUTE')),
  0,
  'new domain-schema functions are not executable by anon or authenticated'
);

-- Denied: a table or function created in public by mistake is not reachable
select ok(not has_table_privilege('anon', 'public.tap_probe', 'SELECT'), 'anon cannot read a new public table');
select ok(not has_table_privilege('authenticated', 'public.tap_probe', 'SELECT'), 'authenticated cannot read a new public table');
select ok(not has_table_privilege('authenticated', 'public.tap_probe', 'INSERT'), 'authenticated cannot write a new public table');
select ok(not has_function_privilege('anon', 'public.tap_probe()', 'EXECUTE'), 'anon cannot execute a new public function');

-- Allowed: the owner keeps full rights (migrations can still grant explicitly)
select ok(has_function_privilege('postgres', 'identity.tap_probe()', 'EXECUTE'), 'postgres can execute its own function');

-- Denied, by acting as the role: anon and authenticated cannot create in or read from a domain schema
set local role anon;
select throws_ok($$create table identity.tap_x (id int)$$, '42501', null, 'anon cannot create a table in identity');
select throws_ok($$select identity.tap_probe()$$, '42501', null, 'anon cannot call a function in identity');
reset role;

set local role authenticated;
select throws_ok($$create table clinical.tap_x (id int)$$, '42501', null, 'authenticated cannot create a table in clinical');
select throws_ok($$select clinical.tap_probe()$$, '42501', null, 'authenticated cannot call a function in clinical');
reset role;

-- Queues and cron are not reachable by the API roles
select ok(
  not has_schema_privilege('anon', 'pgmq', 'USAGE') and not has_schema_privilege('authenticated', 'pgmq', 'USAGE'),
  'pgmq schema is not usable by anon or authenticated'
);
select ok(
  not has_schema_privilege('anon', 'cron', 'USAGE') and not has_schema_privilege('authenticated', 'cron', 'USAGE'),
  'cron schema is not usable by anon or authenticated'
);

select * from finish();
rollback;
