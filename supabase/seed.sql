-- seed.sql — SYNTHETIC DATA ONLY. Never real patient data (CLAUDE.md).
--
-- Runs on the LOCAL stack only, after migrations, on `supabase start` and `supabase db reset`.
-- It is never pushed to the hosted projects (`supabase db push` does not run seeds unless
-- --include-seed is passed, which we never do).
--
-- Step 0.2 has no tables yet, so the only synthetic data is sign-in accounts in Supabase Auth:
--   * names are obviously fake: "Test Patient 001", "Test Clinician 001", …
--   * emails use the reserved .test domain (RFC 2606), so no mail can ever reach a real person
--   * fixed UUIDs, so future pgTAP tests can refer to them
--   * one shared local-only password: JoRapha-Local-Only-2026!  (12+ chars, matches config.toml)
-- Roles are only a label in user metadata; real roles arrive with the access-token hook (Step 2.1).

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('00000000-0000-4000-8000-000000000001'::uuid, 'test.patient.001@jorapha.test',  'Test Patient 001',        'patient'),
      ('00000000-0000-4000-8000-000000000002'::uuid, 'test.patient.002@jorapha.test',  'Test Patient 002',        'patient'),
      ('00000000-0000-4000-8000-000000000003'::uuid, 'test.patient.003@jorapha.test',  'Test Patient 003',        'patient'),
      ('00000000-0000-4000-8000-000000000011'::uuid, 'test.caregiver.001@jorapha.test', 'Test Caregiver 001',     'caregiver'),
      ('00000000-0000-4000-8000-000000000021'::uuid, 'test.clinician.001@jorapha.test', 'Test Clinician 001',     'clinician'),
      ('00000000-0000-4000-8000-000000000031'::uuid, 'test.chw.001@jorapha.test',       'Test CHW 001',           'chw'),
      ('00000000-0000-4000-8000-000000000041'::uuid, 'test.facility.001@jorapha.test',  'Test Facility Admin 001', 'facility_admin'),
      ('00000000-0000-4000-8000-000000000051'::uuid, 'test.admin.001@jorapha.test',     'Test Platform Admin 001', 'platform_admin')
    ) as t(id, email, full_name, synthetic_role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('JoRapha-Local-Only-2026!', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', u.full_name, 'synthetic', true, 'synthetic_role', u.synthetic_role),
      now(), now(), '', '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      u.id, u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now()
    )
    on conflict do nothing;
  end loop;
end
$$;

-- Step 2.1: roles for the synthetic accounts (identity.membership is what the access-token hook reads).
-- The user_account rows are created by the on-insert trigger on auth.users (migration 0006).
insert into provider.organization (id, kind, name, verification_status, verified_by, verified_at, status)
values ('00000000-0000-4000-8000-0000000000a1', 'health_centre', 'Test Health Centre 001 (synthetic)',
        'verified', '00000000-0000-4000-8000-000000000051', now(), 'active')
on conflict (id) do nothing;

insert into identity.membership (id, user_account_id, role, organization_id, granted_by)
values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000001', 'patient', null, null),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-000000000021', 'clinician',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000051'),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-000000000031', 'chw',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000051'),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-000000000041', 'facility_admin',
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000051'),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-000000000051', 'platform_admin', null, null)
on conflict (id) do nothing;
