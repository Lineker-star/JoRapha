-- 0015_offline_spike: Step 1.4 offline proof-of-concept (ADR-002) — households only.
-- 1. household.member_count  2. PowerSync replication (publication + role without password)
-- 3. api.sync_household_batch: applies one device batch in one transaction, per-operation ack/reject/conflict.

-- ── 1. Household member count ───────────────────────────────────────────────────────────────────
alter table community.household add column if not exists member_count integer
  check (member_count between 0 and 100);

-- ── 2. PowerSync logical replication ────────────────────────────────────────────────────────────
-- PowerSync reads households, catchments and CHW assignments (assignments scope the downloads).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    create publication powersync for table community.household, community.catchment, community.chw_assignment;
  end if;
end
$$;

-- The replication role is created WITHOUT a password and cannot log in. The owner enables it outside git:
--   alter role powersync_role with login password '<generated secret>';   (Supabase dashboard, SQL editor)
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role with replication bypassrls nologin;
  end if;
end
$$;
grant usage on schema community to powersync_role;
grant select on community.household, community.catchment, community.chw_assignment to powersync_role;

-- ── 3. Batch ingest (called by the sync-ingest Edge Function with the CHW's own JWT) ────────────
-- p_ops: [{ op_id, idempotency_key, local_sequence, schema_version, op ('insert'|'field_update'),
--           entity_id, base_row_version, client_created_at,
--           data: { catchment_id, name_or_head, village, lat, lng, member_count } }]
-- Returns: { results: [{ op_id, entity_id, state ('applied'|'rejected'|'conflict'), reason_code, row_version }] }
create or replace function api.sync_household_batch(p_device_id uuid, p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op jsonb;
  v_data jsonb;
  v_results jsonb := '[]'::jsonb;
  v_op_id uuid;
  v_key text;
  v_entity uuid;
  v_kind text;
  v_state text;
  v_reason text;
  v_version integer;
  v_existing sync.operation%rowtype;
  v_household community.household%rowtype;
  v_fields text[];
  v_hash text;
begin
  if auth.uid() is null or not private.caller_active() then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.device_registration as d
    where d.id = p_device_id and d.user_account_id = auth.uid() and d.trust_status = 'active'
  ) then
    raise exception 'DEVICE_REVOKED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ops) <> 'array' or jsonb_array_length(p_ops) = 0 or jsonb_array_length(p_ops) > 100 then
    raise exception 'a batch holds 1 to 100 operations' using errcode = '22023';
  end if;

  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_state := null;
    v_reason := null;
    v_version := null;
    v_fields := null;
    v_op_id := nullif(v_op ->> 'op_id', '')::uuid;
    v_key := v_op ->> 'idempotency_key';
    v_entity := nullif(v_op ->> 'entity_id', '')::uuid;
    v_kind := v_op ->> 'op';
    v_data := coalesce(v_op -> 'data', '{}'::jsonb);
    v_hash := encode(sha256(convert_to(v_op::text, 'UTF8')), 'hex');

    -- Idempotency: a replayed key (or operation id) returns the stored outcome, nothing is applied twice.
    select * into v_existing from sync.operation as o
    where (o.device_id = p_device_id and o.idempotency_key = v_key) or o.id = v_op_id
    limit 1;
    if found then
      v_results := v_results || jsonb_build_object(
        'op_id', v_existing.id, 'entity_id', v_existing.entity_id, 'state', v_existing.state,
        'reason_code', v_existing.reason_code, 'row_version', v_existing.result -> 'row_version', 'replayed', true);
      continue;
    end if;

    begin
      if v_op_id is null or v_entity is null or v_key is null or char_length(v_key) < 8 then
        v_state := 'rejected'; v_reason := 'INVALID_PAYLOAD';
      elsif coalesce((v_op ->> 'schema_version')::integer, 0) <> 1 then
        v_state := 'rejected'; v_reason := 'UNSUPPORTED_SCHEMA_VERSION';
      elsif v_kind = 'insert' then
        if exists (select 1 from community.household as h where h.id = v_entity) then
          v_state := 'rejected'; v_reason := 'ID_EXISTS';
        elsif not private.covers_catchment((v_data ->> 'catchment_id')::uuid) then
          v_state := 'rejected'; v_reason := 'NOT_IN_CATCHMENT';
        else
          insert into community.household (
            id, catchment_id, name_or_head, village, position, member_count, origin_device_id, client_created_at)
          values (
            v_entity, (v_data ->> 'catchment_id')::uuid, v_data ->> 'name_or_head', v_data ->> 'village',
            case when v_data ? 'lat' and v_data ? 'lng'
              then extensions.st_setsrid(extensions.st_makepoint((v_data ->> 'lng')::float8, (v_data ->> 'lat')::float8), 4326)::extensions.geography
            end,
            (v_data ->> 'member_count')::integer, p_device_id, (v_op ->> 'client_created_at')::timestamptz)
          returning row_version into v_version;
          v_state := 'applied';
        end if;
      elsif v_kind = 'field_update' then
        select * into v_household from community.household as h where h.id = v_entity for update;
        if not found then
          v_state := 'rejected'; v_reason := 'NOT_FOUND';
        elsif not private.covers_catchment(v_household.catchment_id) then
          v_state := 'rejected'; v_reason := 'NOT_IN_CATCHMENT';
        elsif v_data ? 'catchment_id' and (v_data ->> 'catchment_id')::uuid is distinct from v_household.catchment_id then
          -- Moving a household between catchments is identity-critical: never applied from a device.
          v_state := 'conflict'; v_reason := 'CATCHMENT_CHANGE'; v_fields := array['catchment_id'];
        elsif (v_op ->> 'base_row_version')::integer is distinct from v_household.row_version then
          v_state := 'conflict'; v_reason := 'STALE_VERSION';
          select array_agg(k) into v_fields from jsonb_object_keys(v_data) as k;
        else
          update community.household set
            name_or_head = case when v_data ? 'name_or_head' then v_data ->> 'name_or_head' else name_or_head end,
            village = case when v_data ? 'village' then v_data ->> 'village' else village end,
            member_count = case when v_data ? 'member_count' then (v_data ->> 'member_count')::integer else member_count end,
            position = case when v_data ? 'lat' and v_data ? 'lng'
              then extensions.st_setsrid(extensions.st_makepoint((v_data ->> 'lng')::float8, (v_data ->> 'lat')::float8), 4326)::extensions.geography
              else position end
          where id = v_entity
          returning row_version into v_version;
          v_state := 'applied';
        end if;
      else
        v_state := 'rejected'; v_reason := 'UNSUPPORTED_OP';
      end if;
    exception
      when check_violation or invalid_text_representation or numeric_value_out_of_range
        or not_null_violation or invalid_parameter_value or datetime_field_overflow
        or invalid_datetime_format then
        v_state := 'rejected'; v_reason := 'INVALID_PAYLOAD';
    end;

    insert into sync.operation (
      id, device_id, user_account_id, idempotency_key, local_sequence, schema_version, entity_table, entity_id,
      base_row_version, op, payload_sha256, state, reason_code, result, applied_at, client_created_at)
    values (
      coalesce(v_op_id, gen_random_uuid()), p_device_id, auth.uid(), coalesce(v_key, 'invalid-' || gen_random_uuid()),
      coalesce((v_op ->> 'local_sequence')::bigint, 0), coalesce((v_op ->> 'schema_version')::integer, 1),
      'community.household', coalesce(v_entity, '00000000-0000-0000-0000-000000000000'::uuid),
      (v_op ->> 'base_row_version')::integer,
      case when v_kind in ('insert', 'field_update') then v_kind else 'request' end,
      v_hash, v_state, v_reason, jsonb_build_object('row_version', v_version),
      case when v_state = 'applied' then now() end,
      nullif(v_op ->> 'client_created_at', '')::timestamptz)
    returning id into v_op_id;

    if v_state = 'conflict' then
      insert into sync.conflict (operation_id, entity_table, entity_id, fields, server_row_version)
      values (v_op_id, 'community.household', v_entity, coalesce(v_fields, '{}'), v_household.row_version);
    end if;

    v_results := v_results || jsonb_build_object(
      'op_id', v_op_id, 'entity_id', v_entity, 'state', v_state, 'reason_code', v_reason, 'row_version', v_version);
  end loop;

  update identity.device_registration set last_sync_at = now() where id = p_device_id;
  return jsonb_build_object('results', v_results);
end;
$$;

revoke execute on function api.sync_household_batch(uuid, jsonb) from public, anon;
grant execute on function api.sync_household_batch(uuid, jsonb) to authenticated;
