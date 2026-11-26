// sync-ingest — Step 1.4 offline spike (ADR-002). Receives one batch of offline operations from a device.
//
// 1. Verifies the caller's JWT with Supabase Auth (no service_role key is used for writes).
// 2. Validates the envelope; each operation is validated on its own: an invalid one is rejected in the
//    answer, the valid ones still go through (one bad record never costs the others).
// 3. Calls api.sync_household_batch AS THE CALLER, so role, catchment, device and idempotency checks run in
//    Postgres (migration 0015, tested by supabase/tests/0006_offline_spike.test.sql) in one transaction.
// 4. Status codes the app relies on:
//      200 per-operation results (applied / rejected / conflict + reason code)
//      400 envelope malformed (client bug)            → the app keeps its queue
//      401 not signed in
//      403 { error: DEVICE_UNKNOWN }  → re-register the device, then retry
//      403 { error: DEVICE_REVOKED }  → purge local data
//      403 { error: FORBIDDEN }       → account not allowed (shown, queue kept)
//      503 any other server error     → the app retries later; nothing is dropped
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

const envelope = z
  .object({
    device_id: uuid,
    ops: z.array(z.unknown()).min(1).max(100),
  })
  .strict();

type Result = {
  op_id: unknown;
  entity_id: unknown;
  state: 'applied' | 'rejected' | 'conflict';
  reason_code: string | null;
  row_version: number | null;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'UNAUTHENTICATED' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(authorization.slice(7));
  if (userError || !userData.user) return json(401, { error: 'UNAUTHENTICATED' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'INVALID_JSON' });
  }

  const parsed = envelope.safeParse(body);
  if (!parsed.success) {
    return json(400, {
      error: 'INVALID_ENVELOPE',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
    });
  }

  // Validate each operation on its own; remember positions so the answer keeps the device's order.
  const results: (Result | null)[] = parsed.data.ops.map(() => null);
  const valid: { index: number; op: z.infer<typeof operation> }[] = [];
  parsed.data.ops.forEach((raw, index) => {
    const op = operation.safeParse(raw);
    if (op.success) valid.push({ index, op: op.data });
    else
      results[index] = {
        op_id: field(raw, 'op_id') ?? null,
        entity_id: field(raw, 'entity_id') ?? null,
        state: 'rejected',
        reason_code: 'INVALID_PAYLOAD',
        row_version: null,
      };
  });

  if (valid.length > 0) {
    const { data, error } = await supabase.schema('api').rpc('sync_household_batch', {
      p_device_id: parsed.data.device_id,
      p_ops: valid.map((v) => v.op),
    });

    if (error) {
      if (error.code === '42501') {
        const reason = error.message.includes('DEVICE_REVOKED')
          ? 'DEVICE_REVOKED'
          : error.message.includes('DEVICE_UNKNOWN')
            ? 'DEVICE_UNKNOWN'
            : 'FORBIDDEN';
        console.warn(`sync-ingest: batch refused (${reason})`);
        return json(403, { error: reason });
      }
      if (error.code === '22023') return json(400, { error: 'INVALID_ENVELOPE' });
      console.error(`sync-ingest: database error ${error.code ?? 'unknown'}; client will retry`);
      return json(503, { error: 'RETRY_LATER' });
    }

    const serverResults = (data as { results: Result[] }).results;
    valid.forEach((v, i) => {
      results[v.index] = serverResults[i] ?? null;
    });
  }

  const final = results.filter((r): r is Result => r !== null);
  const counts = final.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`sync-ingest: ${final.length} ops ${JSON.stringify(counts)}`);
  return json(200, { results: final });
});
