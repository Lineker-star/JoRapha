// sync-ingest — Step 1.4 offline spike (ADR-002). Receives one batch of offline operations from a device.
//
// 1. Verifies the caller's JWT with Supabase Auth (no service_role key is used for writes).
// 2. Validates the batch shape with zod.
// 3. Calls api.sync_household_batch AS THE CALLER, so role, catchment, device and idempotency checks run in
//    Postgres (migration 0015, tested by supabase/tests/0006_offline_spike.test.sql) in one transaction.
// 4. Returns per-operation ack / reject / conflict with reason codes.
//
// Never logs payloads (they can contain personal data); logs only counts and reason codes.

import { createClient } from 'npm:@supabase/supabase-js@2.119.1';
import { z } from 'npm:zod@4.6.7';

const uuid = z.string().uuid();

const householdData = z
  .object({
    catchment_id: uuid.optional(),
    name_or_head: z.string().trim().min(1).max(200).optional(),
    village: z.string().trim().max(150).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    member_count: z.number().int().min(0).max(100).optional(),
  })
  .strict();

const operation = z
  .object({
    op_id: uuid,
    idempotency_key: z.string().min(8).max(200),
    local_sequence: z.number().int().min(0),
    schema_version: z.literal(1),
    op: z.enum(['insert', 'field_update']),
    entity_id: uuid,
    base_row_version: z.number().int().positive().nullable().optional(),
    client_created_at: z.string().datetime({ offset: true }).optional(),
    data: householdData,
  })
  .strict()
  .refine((o) => o.op !== 'insert' || o.data.catchment_id !== undefined, {
    message: 'insert requires data.catchment_id',
  });

const batch = z
  .object({
    device_id: uuid,
    ops: z.array(operation).min(1).max(100),
  })
  .strict();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'UNAUTHENTICATED' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the JWT with Supabase Auth (signature, expiry, revocation of the session).
  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return json(401, { error: 'UNAUTHENTICATED' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'INVALID_JSON' });
  }

  const parsed = batch.safeParse(body);
  if (!parsed.success) {
    // Field paths only, never values.
    return json(400, {
      error: 'INVALID_PAYLOAD',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
    });
  }

  const { data, error } = await supabase
    .schema('api')
    .rpc('sync_household_batch', { p_device_id: parsed.data.device_id, p_ops: parsed.data.ops });

  if (error) {
    const reason = error.message.includes('DEVICE_REVOKED') ? 'DEVICE_REVOKED' : 'REJECTED';
    console.warn(`sync-ingest: batch refused (${reason}, code ${error.code})`);
    return json(error.code === '42501' ? 403 : 400, { error: reason });
  }

  const results = (data as { results: { state: string }[] }).results;
  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`sync-ingest: ${results.length} ops ${JSON.stringify(counts)}`);
  return json(200, data);
});
