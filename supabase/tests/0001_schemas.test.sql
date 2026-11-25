-- pgTAP: extensions and domain schemas from 0001_extensions.sql, with default deny.
-- Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
begin;

-- Test-only extension, created inside this transaction and rolled back with it.
create extension if not exists pgtap with schema extensions;

select plan(30);

-- Extensions
select has_extension('pgcrypto', 'pgcrypto is enabled');
select has_extension('postgis', 'postgis is enabled');
select has_extension('pg_cron', 'pg_cron is enabled');
select has_extension('pgmq', 'pgmq (Supabase Queues) is enabled');
select is(
  (select extnamespace::regnamespace::text from pg_extension where extname = 'postgis'),
  'extensions',
  'postgis lives in the extensions schema, not public'
);

-- The 13 domain schemas exist
select has_schema('identity');
select has_schema('patient');
select has_schema('provider');
select has_schema('scheduling');
select has_schema('clinical');
select has_schema('referral');
select has_schema('lab');
select has_schema('pharmacy');
select has_schema('community');
select has_schema('billing');
select has_schema('content');
select has_schema('audit');
select has_schema('sync');

-- Denied access: the public API roles cannot even see inside any domain schema
select is(
  (select count(*)::int
     from unnest(array['identity','patient','provider','scheduling','clinical','referral','lab',
                       'pharmacy','community','billing','content','audit','sync']) as s
    where has_schema_privilege('anon', s, 'USAGE')),
  0,
  'anon has USAGE on no domain schema'
);
-- Since Step 1.2 authenticated may enter exactly the schemas whose tables have RLS; the rest stay closed.
select is(
  (select array_agg(s order by s)
     from unnest(array['identity','patient','provider','scheduling','clinical','referral','lab',
                       'pharmacy','community','billing','content','audit','sync']) as s
    where has_schema_privilege('authenticated', s, 'USAGE')),
  array['audit','clinical','community','identity','patient','provider','sync'],
  'authenticated has USAGE only on the domain schemas implemented with RLS (Step 1.2)'
);
select is(
  (select count(*)::int
     from unnest(array['identity','patient','provider','scheduling','clinical','referral','lab',
                       'pharmacy','community','billing','content','audit','sync']) as s
    where has_schema_privilege('anon', s, 'CREATE') or has_schema_privilege('authenticated', s, 'CREATE')),
  0,
  'neither anon nor authenticated can create objects in a domain schema'
);

-- Every table in a domain schema has RLS enabled AND forced (Step 1.2: no policy = no access)
select is(
  (select count(*)::int from pg_class as c join pg_namespace as n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname in ('identity','patient','provider','scheduling','clinical','referral','lab',
                        'pharmacy','community','billing','content','audit','sync')
      and not (c.relrowsecurity and c.relforcerowsecurity)),
  0,
  'every domain table has row level security enabled and forced'
);

-- Seed data is clearly synthetic: every seeded user uses the reserved .test domain
select is(
  (select count(*)::int from auth.users where email not like '%@jorapha.test'),
  0,
  'every auth user in the local database is a synthetic @jorapha.test account'
);

-- Extensions in usable state
select lives_ok($$select extensions.gen_random_uuid()$$, 'pgcrypto gen_random_uuid() works');
select lives_ok($$select extensions.st_astext(extensions.st_makepoint(13.68, 4.58))$$, 'postgis works (Bertoua)');
select has_schema('cron', 'pg_cron created the cron schema');
select has_schema('pgmq', 'pgmq created its schema');
select lives_ok($$select pgmq.create('step_0_2_smoke_test')$$, 'a queue can be created');
select lives_ok($$select pgmq.send('step_0_2_smoke_test', '{"synthetic": true}'::jsonb)$$, 'a message can be sent');
select is(
  (select count(*)::int from pgmq.read('step_0_2_smoke_test', 30, 1)),
  1,
  'the message can be read back'
);

select * from finish();
rollback;
