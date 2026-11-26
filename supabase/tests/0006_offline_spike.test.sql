-- pgTAP: api.sync_household_batch (migration 0015, Step 1.4 offline spike).
-- Run with: pnpm supabase test db   (needs the local stack: pnpm supabase start)
begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

-- ── Fixtures (as postgres, no JWT) ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '', true);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-4000-8000-160000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.spike.chw@jorapha.test'),
  ('00000000-0000-4000-8000-160000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.spike.other@jorapha.test'),
  ('00000000-0000-4000-8000-160000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tap.spike.admin@jorapha.test');
insert into provider.organization (id, kind, name, verification_status, verified_by, verified_at, status) values
  ('00000000-0000-4000-8000-460000000001', 'community_programme', 'TAP Spike Programme', 'verified',
   '00000000-0000-4000-8000-160000000009', now(), 'active');
insert into identity.membership (user_account_id, role, organization_id, granted_by) values
  ('00000000-0000-4000-8000-160000000001', 'chw', '00000000-0000-4000-8000-460000000001', '00000000-0000-4000-8000-160000000009'),
  ('00000000-0000-4000-8000-160000000002', 'chw', '00000000-0000-4000-8000-460000000001', '00000000-0000-4000-8000-160000000009');
insert into community.catchment (id, organization_id, name) values
  ('00000000-0000-4000-8000-e60000000001', '00000000-0000-4000-8000-460000000001', 'TAP spike catchment A'),
  ('00000000-0000-4000-8000-e60000000002', '00000000-0000-4000-8000-460000000001', 'TAP spike catchment B');
insert into community.chw_assignment (user_account_id, catchment_id) values
  ('00000000-0000-4000-8000-160000000001', '00000000-0000-4000-8000-e60000000001'),
  ('00000000-0000-4000-8000-160000000002', '00000000-0000-4000-8000-e60000000002');
insert into identity.device_registration (id, user_account_id, app, platform) values
  ('00000000-0000-4000-8000-0d6000000001', '00000000-0000-4000-8000-160000000001', 'chw', 'android'),
  ('00000000-0000-4000-8000-0d6000000002', '00000000-0000-4000-8000-160000000002', 'chw', 'android'),
  ('00000000-0000-4000-8000-0d6000000003', '00000000-0000-4000-8000-160000000001', 'chw', 'android');
update identity.device_registration set trust_status = 'revoked', revoked_at = now(), revoked_by = '00000000-0000-4000-8000-160000000009',
  revocation_reason = 'lost' where id = '00000000-0000-4000-8000-0d6000000003';

-- ── As the CHW of catchment A ───────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-160000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;

-- A mixed batch: one valid insert, one outside the catchment, one invalid member count, one bad schema version.
select is(
  (select jsonb_agg(r ->> 'state' order by ord) from jsonb_array_elements((api.sync_household_batch(
    '00000000-0000-4000-8000-0d6000000001',
    '[{"op_id":"00000000-0000-4000-8000-5c6000000001","idempotency_key":"spike-key-0001","local_sequence":1,"schema_version":1,
       "op":"insert","entity_id":"00000000-0000-4000-8000-f60000000001","client_created_at":"2001-01-01T00:00:00Z",
       "data":{"catchment_id":"00000000-0000-4000-8000-e60000000001","name_or_head":"Household One","village":"Bertoua","lat":4.58,"lng":13.68,"member_count":5}},
      {"op_id":"00000000-0000-4000-8000-5c6000000002","idempotency_key":"spike-key-0002","local_sequence":2,"schema_version":1,
       "op":"insert","entity_id":"00000000-0000-4000-8000-f60000000002",
       "data":{"catchment_id":"00000000-0000-4000-8000-e60000000002","name_or_head":"Not mine","member_count":2}},
      {"op_id":"00000000-0000-4000-8000-5c6000000003","idempotency_key":"spike-key-0003","local_sequence":3,"schema_version":1,
       "op":"insert","entity_id":"00000000-0000-4000-8000-f60000000003",
       "data":{"catchment_id":"00000000-0000-4000-8000-e60000000001","name_or_head":"Bad count","member_count":-4}},
      {"op_id":"00000000-0000-4000-8000-5c6000000004","idempotency_key":"spike-key-0004","local_sequence":4,"schema_version":9,
       "op":"insert","entity_id":"00000000-0000-4000-8000-f60000000004",
       "data":{"catchment_id":"00000000-0000-4000-8000-e60000000001"}}]'::jsonb) -> 'results')) with ordinality as t(r, ord)),
  '["applied","rejected","rejected","rejected"]'::jsonb,
  'a mixed batch is applied per operation: one bad operation does not block the others');

select is(
  (select jsonb_agg(o.reason_code order by o.local_sequence) from sync.operation as o
    where o.device_id = '00000000-0000-4000-8000-0d6000000001'),
  '[null,"NOT_IN_CATCHMENT","INVALID_PAYLOAD","UNSUPPORTED_SCHEMA_VERSION"]'::jsonb,
  'every operation is recorded with a machine-readable reason code');

select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f60000000001'), 1,
  'the valid household is applied');

-- Replay the same batch: nothing is applied twice; the stored outcomes come back.
select is(
  (select jsonb_agg(r ->> 'state' order by ord) from jsonb_array_elements((api.sync_household_batch(
    '00000000-0000-4000-8000-0d6000000001',
    '[{"op_id":"00000000-0000-4000-8000-5c6000000001","idempotency_key":"spike-key-0001","local_sequence":1,"schema_version":1,
       "op":"insert","entity_id":"00000000-0000-4000-8000-f60000000001",
       "data":{"catchment_id":"00000000-0000-4000-8000-e60000000001","name_or_head":"Household One"}},
      {"op_id":"00000000-0000-4000-8000-5c6000000002","idempotency_key":"spike-key-0002","local_sequence":2,"schema_version":1,
       "op":"insert","entity_id":"00000000-0000-4000-8000-f60000000002","data":{}}]'::jsonb) -> 'results')) with ordinality as t(r, ord)),
  '["applied","rejected"]'::jsonb,
  'sending the same batch twice returns the first outcome');
select is((select count(*)::int from sync.operation where device_id = '00000000-0000-4000-8000-0d6000000001'), 4,
  'a replay creates no new operations');
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f60000000001'), 1,
  'a replay creates no duplicate household');

-- Field update with the right base version is applied.
select is(
  ((api.sync_household_batch('00000000-0000-4000-8000-0d6000000001',
    '[{"op_id":"00000000-0000-4000-8000-5c6000000005","idempotency_key":"spike-key-0005","local_sequence":5,"schema_version":1,
       "op":"field_update","entity_id":"00000000-0000-4000-8000-f60000000001","base_row_version":1,
       "data":{"member_count":6}}]'::jsonb) -> 'results') -> 0 ->> 'state'),
  'applied', 'an update with the current base version is applied');

-- Same base version again (now stale) → conflict, recorded in sync.conflict, nothing overwritten.
select is(
  ((api.sync_household_batch('00000000-0000-4000-8000-0d6000000001',
    '[{"op_id":"00000000-0000-4000-8000-5c6000000006","idempotency_key":"spike-key-0006","local_sequence":6,"schema_version":1,
       "op":"field_update","entity_id":"00000000-0000-4000-8000-f60000000001","base_row_version":1,
       "data":{"member_count":9}}]'::jsonb) -> 'results') -> 0 ->> 'reason_code'),
  'STALE_VERSION', 'an update based on an old version becomes a conflict');
select is(
  ((api.sync_household_batch('00000000-0000-4000-8000-0d6000000001',
    '[{"op_id":"00000000-0000-4000-8000-5c6000000007","idempotency_key":"spike-key-0007","local_sequence":7,"schema_version":1,
       "op":"field_update","entity_id":"00000000-0000-4000-8000-f60000000001","base_row_version":2,
       "data":{"catchment_id":"00000000-0000-4000-8000-e60000000002"}}]'::jsonb) -> 'results') -> 0 ->> 'reason_code'),
  'CATCHMENT_CHANGE', 'moving a household to another catchment is never applied from a device');
reset role;

select is((select member_count from community.household where id = '00000000-0000-4000-8000-f60000000001'), 6,
  'the conflicting value did not overwrite the server value');
select is((select count(*)::int from sync.conflict where entity_id = '00000000-0000-4000-8000-f60000000001'), 2,
  'both conflicts are queued for review');
select is((select created_at from community.household where id = '00000000-0000-4000-8000-f60000000001'), now(),
  'server time is the record time');
select is((select client_created_at from community.household where id = '00000000-0000-4000-8000-f60000000001'),
  '2001-01-01T00:00:00Z'::timestamptz, 'a wrong device clock is kept only as device-reported metadata');
select ok((select last_sync_at is not null from identity.device_registration where id = '00000000-0000-4000-8000-0d6000000001'),
  'the device''s last sync time is updated');

-- ── Devices ─────────────────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-160000000001","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select throws_ok($$select api.sync_household_batch('00000000-0000-4000-8000-0d6000000003',
  '[{"op_id":"00000000-0000-4000-8000-5c6000000008","idempotency_key":"spike-key-0008","schema_version":1,"op":"insert",
     "entity_id":"00000000-0000-4000-8000-f60000000008","data":{"catchment_id":"00000000-0000-4000-8000-e60000000001"}}]')$$,
  '42501', 'DEVICE_REVOKED', 'a revoked device cannot sync');
select throws_ok($$select api.sync_household_batch('00000000-0000-4000-8000-0d6000000002',
  '[{"op_id":"00000000-0000-4000-8000-5c6000000009","idempotency_key":"spike-key-0009","schema_version":1,"op":"insert",
     "entity_id":"00000000-0000-4000-8000-f60000000009","data":{"catchment_id":"00000000-0000-4000-8000-e60000000001"}}]')$$,
  '42501', 'DEVICE_REVOKED', 'another account''s device cannot be used');
select throws_ok($$select api.sync_household_batch('00000000-0000-4000-8000-0d6000000001', '[]')$$,
  '22023', null, 'an empty batch is refused');
reset role;

-- The other CHW (catchment B) cannot read catchment A's household.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-160000000002","role":"authenticated","aal":"aal1"}', true);
set local role authenticated;
select is((select count(*)::int from community.household where id = '00000000-0000-4000-8000-f60000000001'), 0,
  'a CHW of another catchment does not see the household');
reset role;

set local role anon;
select throws_ok($$select api.sync_household_batch('00000000-0000-4000-8000-0d6000000001', '[]')$$,
  '42501', null, 'anon cannot call the ingest function');
reset role;

select * from finish();
rollback;
