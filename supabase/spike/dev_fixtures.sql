-- Step 1.4 offline spike — synthetic fixtures for the DEV project only (rdozfdblandlqixixczr).
-- Synthetic data only. Never run on staging or production.
--
-- Prerequisite (owner): create the Auth user `spike.chw1@jorapha.test` in the dashboard
-- (Authentication → Users → Add user → Create new user, "Auto Confirm User" ticked) with a password you choose.
-- The password is never written here or in chat.
--
-- Run: pnpm supabase db query --remote=rdozfdblandlqixixczr --yes -f supabase/spike/dev_fixtures.sql
-- Idempotent: fixed UUIDs, `on conflict do nothing`.

do $$
declare
  v_chw uuid;
begin
  select id into v_chw from auth.users where email = 'spike.chw1@jorapha.test';
  if v_chw is null then
    raise exception 'Create the Auth user spike.chw1@jorapha.test in the dashboard first';
  end if;

  -- The on-insert trigger normally creates this row; kept here in case the user predates it.
  insert into identity.user_account (id) values (v_chw) on conflict (id) do nothing;

  insert into provider.organization (id, kind, name, verification_status, verified_by, verified_at, status)
  values ('5b1ce000-0000-4000-8000-000000000001', 'community_programme', 'Spike Test Programme (synthetic)',
          'verified', v_chw, now(), 'active')
  on conflict (id) do nothing;

  insert into community.catchment (id, organization_id, name)
  values ('5b1ce000-0000-4000-8000-0000000000c1', '5b1ce000-0000-4000-8000-000000000001',
          'Spike catchment Bertoua-Test (synthetic)')
  on conflict (id) do nothing;

  if not exists (select 1 from identity.membership
                 where user_account_id = v_chw and role = 'chw'
                   and organization_id = '5b1ce000-0000-4000-8000-000000000001' and status = 'active') then
    insert into identity.membership (user_account_id, role, organization_id)
    values (v_chw, 'chw', '5b1ce000-0000-4000-8000-000000000001');
  end if;

  insert into community.chw_assignment (id, user_account_id, catchment_id)
  values ('5b1ce000-0000-4000-8000-0000000000a1', v_chw, '5b1ce000-0000-4000-8000-0000000000c1')
  on conflict (id) do nothing;
end;
$$;

select u.email, m.role, m.status as membership, a.status as assignment, c.name as catchment
from auth.users u
join identity.membership m on m.user_account_id = u.id
join community.chw_assignment a on a.user_account_id = u.id
join community.catchment c on c.id = a.catchment_id
where u.email = 'spike.chw1@jorapha.test';
