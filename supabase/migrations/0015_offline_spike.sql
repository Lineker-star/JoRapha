-- 0015_offline_spike: Step 1.4 offline proof-of-concept (ADR-002) — households only.
-- 1. household.member_count  2. PowerSync replication (publication + role without password)
-- 3. expired CHW assignments end automatically (sync rules scope downloads by assignment status)
-- 4. api.sync_household_batch: one device batch in one transaction, per-operation ack/reject/conflict.

-- ── 1. Household member count ───────────────────────────────────────────────────────────────────
alter table community.household add column if not exists member_count integer
  check (member_count between 0 and 100);

-- ── 2. PowerSync logical replication ────────────────────────────────────────────────────────────
-- PowerSync reads households, catchments and CHW assignments (assignments scope the downloads).
-- Whoever holds the replication role's password can read every row of these three tables: the role is
-- created without a password and cannot log in. The owner enables it outside git (runbook in the spike report):
--   alter role powersync_role with login password '<generated secret>' connection limit 5;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'powersync') then
    create publication powersync for table community.household, community.catchment, community.chw_assignment;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role;
  end if;
end
$$;
-- State the attributes explicitly, whatever a pre-existing role had.
alter role powersync_role with nologin replication bypassrls;
grant usage on schema community to powersync_role;
grant select on community.household, community.catchment, community.chw_assignment to powersync_role;

-- ── 3. Expired assignments end automatically ────────────────────────────────────────────────────
-- PowerSync parameter queries cannot compare dates, so downloads rely on chw_assignment.status.
create or replace function private.end_expired_chw_assignments()
returns integer
language sql
security definer
set search_path = ''
as $$
  with ended as (
    update community.chw_assignment set status = 'ended'
    where status = 'active' and valid_to is not null and valid_to <= now()
    returning 1
  )
  select count(*)::integer from ended;
$$;
revoke execute on function private.end_expired_chw_assignments() from public, anon, authenticated;

select cron.schedule('end-expired-chw-assignments', '*/15 * * * *',
  $$select private.end_expired_chw_assignments()$$);

-- ── 4. Batch ingest (called by the sync-ingest Edge Function with the CHW's own JWT) ────────────
-- p_ops: [{ op_id, idempotency_key, local_sequence, schema_version, op ('insert'|'field_update'),
--           entity_id, base_row_version, client_created_at,
--           data: { catchment_id, name_or_head, village, lat, lng, member_count } }]
-- Returns: { results: [{ op_id, entity_id, state ('applied'|'rejected'|'conflict'), reason_code, row_version }] }
-- Raises (whole batch, client keeps its queue): DEVICE_UNKNOWN (re-register), DEVICE_REVOKED (purge), 22023 (shape).
-- Any unexpected database error aborts the whole batch, so the client retries instead of losing operations.
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
  v_schema integer;
  v_base integer;
  v_seq bigint;
  v_client_time timestamptz;
  v_catchment uuid;
  v_lat float8;
  v_lng float8;
  v_has_position boolean;
  v_state text;
  v_reason text;
  v_version integer;
  v_existing sync.operation%rowtype;
  v_household community.household%rowtype;
  v_fields text[];
  v_hash text;
  v_trust text;
begin
  if auth.uid() is null or not private.caller_active() then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select d.trust_status into v_trust
  from identity.device_registration as d
  where d.id = p_device_id and d.user_account_id = auth.uid();
  if not found then
    raise exception 'DEVICE_UNKNOWN' using errcode = '42501';
  elsif v_trust <> 'active' then
    raise exception 'DEVICE_REVOKED' using errcode = '42501';
  end if;
  if jsonb_typeof(p_ops) is distinct from 'array' or jsonb_array_length(p_ops) = 0 or jsonb_array_length(p_ops) > 100 then
    raise exception 'a batch holds 1 to 100 operations' using errcode = '22023';
  end if;

  -- One batch per device at a time: a retry sent while the original is still running waits, then replays.
  perform pg_advisory_xact_lock(hashtextextended('sync_household_batch:' || p_device_id::text, 0));

  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_state := null; v_reason := null; v_version := null; v_fields := null; v_household := null;
    v_op_id := null; v_entity := null; v_key := null; v_kind := v_op ->> 'op';
    v_data := case when jsonb_typeof(v_op -> 'data') = 'object' then v_op -> 'data' else '{}'::jsonb end;
    v_hash := encode(sha256(convert_to(v_op::text, 'UTF8')), 'hex');

    -- Parse inside its own block: a malformed operation is rejected, never aborts the batch.
    begin
      v_op_id := (v_op ->> 'op_id')::uuid;
      v_entity := (v_op ->> 'entity_id')::uuid;
      v_key := v_op ->> 'idempotency_key';
      v_schema := (v_op ->> 'schema_version')::integer;
      v_base := (v_op ->> 'base_row_version')::integer;
      v_seq := coalesce((v_op ->> 'local_sequence')::bigint, 0);
      v_client_time := (v_op ->> 'client_created_at')::timestamptz;
      v_catchment := (v_data ->> 'catchment_id')::uuid;
      v_has_position := jsonb_typeof(v_data -> 'lat') = 'number' and jsonb_typeof(v_data -> 'lng') = 'number';
      if v_has_position then
        v_lat := (v_data ->> 'lat')::float8;
        v_lng := (v_data ->> 'lng')::float8;
        if v_lat not between -90 and 90 or v_lng not between -180 and 180 then
          raise exception 'position out of range' using errcode = '22003';
        end if;
      end if;
      if v_op_id is null or v_entity is null or v_key is null or char_length(v_key) not between 8 and 200 then
        raise exception 'missing identifiers' using errcode = '22023';
      end if;
    exception when data_exception then
      v_state := 'rejected'; v_reason := 'INVALID_PAYLOAD';
    end;

    if v_state is null then
      -- Idempotency, scoped to this caller and device. Same key/id + same payload → stored outcome.
      -- Same key/id with a different payload or entity → IDEMPOTENCY_MISMATCH (never a false "applied").
      select * into v_existing from sync.operation as o
      where o.user_account_id = auth.uid()
        and ((o.device_id = p_device_id and o.idempotency_key = v_key) or o.id = v_op_id)
      limit 1;
      if found then
        if v_existing.payload_sha256 = v_hash and v_existing.entity_id = v_entity and v_existing.id = v_op_id then
          v_results := v_results || jsonb_build_object(
            'op_id', v_existing.id, 'entity_id', v_existing.entity_id, 'state', v_existing.state,
            'reason_code', v_existing.reason_code, 'row_version', v_existing.result -> 'row_version', 'replayed', true);
        else
          v_results := v_results || jsonb_build_object(
            'op_id', v_op_id, 'entity_id', v_entity, 'state', 'rejected', 'reason_code', 'IDEMPOTENCY_MISMATCH',
            'row_version', null);
        end if;
        continue;
      end if;
      -- An operation id already used by someone else: reject without revealing anything about it.
      if exists (select 1 from sync.operation as o where o.id = v_op_id) then
        v_results := v_results || jsonb_build_object(
          'op_id', v_op_id, 'entity_id', v_entity, 'state', 'rejected', 'reason_code', 'IDEMPOTENCY_MISMATCH',
          'row_version', null);
        continue;
      end if;
    end if;

    if v_state is null then
      begin
        if v_schema is distinct from 1 then
          v_state := 'rejected'; v_reason := 'UNSUPPORTED_SCHEMA_VERSION';
        elsif v_kind = 'insert' then
          if v_catchment is null or not private.covers_catchment(v_catchment) then
            v_state := 'rejected'; v_reason := 'NOT_IN_CATCHMENT';
          elsif exists (select 1 from community.household as h where h.id = v_entity) then
            v_state := 'rejected'; v_reason := 'ID_EXISTS';
          else
            insert into community.household (
              id, catchment_id, name_or_head, village, position, member_count, origin_device_id, client_created_at)
            values (
              v_entity, v_catchment, v_data ->> 'name_or_head', v_data ->> 'village',
              case when v_has_position
                then extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography end,
              (v_data ->> 'member_count')::integer, p_device_id, v_client_time)
            returning row_version into v_version;
            v_state := 'applied';
          end if;
        elsif v_kind = 'field_update' then
          select * into v_household from community.household as h where h.id = v_entity for update;
          if not found or not private.covers_catchment(v_household.catchment_id) then
            v_state := 'rejected'; v_reason := 'NOT_IN_CATCHMENT'; -- same answer: no probing of other catchments
          elsif v_data ? 'catchment_id' and v_catchment is distinct from v_household.catchment_id then
            v_state := 'conflict'; v_reason := 'CATCHMENT_CHANGE'; v_fields := array['catchment_id'];
          elsif v_base is distinct from v_household.row_version then
            v_state := 'conflict'; v_reason := 'STALE_VERSION';
            select array_agg(k) into v_fields from jsonb_object_keys(v_data) as k;
          else
            update community.household set
              name_or_head = case when v_data ? 'name_or_head' then v_data ->> 'name_or_head' else name_or_head end,
              village = case when v_data ? 'village' then v_data ->> 'village' else village end,
              member_count = case when v_data ? 'member_count' then (v_data ->> 'member_count')::integer else member_count end,
              -- A position is replaced only by a complete new one; nulls never erase it.
              position = case when v_has_position
                then extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography
                else position end
            where id = v_entity
            returning row_version into v_version;
            v_state := 'applied';
          end if;
        else
          v_state := 'rejected'; v_reason := 'UNSUPPORTED_OP';
        end if;
      exception
        -- Bad values from the device (class 22) or table constraints (class 23): reject this operation only.
        when data_exception or integrity_constraint_violation then
          v_state := 'rejected'; v_reason := 'INVALID_PAYLOAD';
      end;
    end if;

    insert into sync.operation (
      id, device_id, user_account_id, idempotency_key, local_sequence, schema_version, entity_table, entity_id,
      base_row_version, op, payload_sha256, state, reason_code, result, applied_at, client_created_at)
    values (
      coalesce(v_op_id, gen_random_uuid()), p_device_id, auth.uid(),
      case when v_key is not null and char_length(v_key) between 8 and 200 and v_op_id is not null
        then v_key else 'invalid-' || gen_random_uuid() end,
      v_seq, coalesce(v_schema, 1), 'community.household',
      coalesce(v_entity, '00000000-0000-0000-0000-000000000000'::uuid), v_base,
      case when v_kind in ('insert', 'field_update') then v_kind else 'request' end,
      v_hash, v_state, v_reason, jsonb_build_object('row_version', v_version),
      case when v_state = 'applied' then now() end, v_client_time)
    returning id into v_op_id;

    if v_state = 'conflict' then
      -- Spike: the CHW's values are not kept (client_values_encrypted stays null); see the report §5.
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
