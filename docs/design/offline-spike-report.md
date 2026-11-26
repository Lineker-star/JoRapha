# Offline spike report — Step 1.4 (ADR-002 go / no-go)

Status: **built and reviewed, device tests not yet run.** The go / no-go recommendation (§6) is filled in only
from results observed on a real phone. Nothing in §4 may be filled in from an emulator or from expectations.

Scope: one entity (`community.household`: name, village, GPS point, member count), CHW app only.
Sources: TA §7 (offline data and sync), PRD §7 (OFF-001…OFF-010), ADR-002, ADR-003.

## 1. What was built

| Part          | Where                                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration     | `supabase/migrations/0015_offline_spike.sql` | `household.member_count`; publication `powersync` (household, catchment, chw_assignment); `powersync_role` (replication + bypassrls, **no password, no login** — enabled by the owner outside git); cron job every 15 min ending CHW assignments past `valid_to`; `api.sync_household_batch`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Batch ingest  | `api.sync_household_batch(device_id, ops)`   | Runs as the CHW (JWT). Whole-batch refusals: `DEVICE_UNKNOWN` (not registered to this caller → the app re-registers, nothing purged), `DEVICE_REVOKED` (→ purge), batch size 1–100. One batch per device at a time (advisory lock). Per operation, each in its own savepoint: parse (bad values → `INVALID_PAYLOAD`, never aborts the batch); idempotency scoped to caller and device (same key + same payload → stored outcome; same key or operation id with a different payload/entity → `IDEMPOTENCY_MISMATCH`, never a false "applied"); catchment (`NOT_IN_CATCHMENT`, checked before existence so ids cannot be probed); schema version; insert or field update; stale `base_row_version` → `STALE_VERSION` conflict; catchment move → `CATCHMENT_CHANGE` conflict; null coordinates never erase a position. Any unexpected database error aborts the whole batch so the device retries. Writes `sync.operation` (hash only, no payload) and `sync.conflict`. Server time is the record time; device time kept as `client_created_at`. |
| Edge Function | `supabase/functions/sync-ingest`             | Verifies the JWT with Supabase Auth, validates the envelope and **each operation separately** (an invalid one is rejected in a 200 answer, the others still go through), calls the function above **with the caller's JWT** (no `service_role`). 403 `DEVICE_UNKNOWN` / `DEVICE_REVOKED` / `FORBIDDEN`; 400 only for a malformed envelope; **503 for any other server error** (the app keeps its queue). Logs counts only, never payloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Sync rules    | `powersync/sync-rules.yaml`                  | A CHW downloads the catchments they are actively assigned to and the active households in them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Shared logic  | `packages/sync/src/households.ts` (+ tests)  | CRUD entry → ingest operation. Idempotency key = `deviceId:op_id`, where `op_id` is a UUID stored with the row at write time (not PowerSync's local counter, which can restart). Server result → UI state; reason codes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| CHW app       | `apps/chw`                                   | SQLCipher database via `@powersync/react-native` 2.4.1 + `@op-engineering/op-sqlite` 18.2.5. Key = 256 random bits generated on first launch, kept only in `expo-secure-store`; **the app refuses to start if `PRAGMA cipher_version` is empty** (encryption not active) or if the key is missing for an existing database (no silent new key). Supabase session in chunked secure storage (never AsyncStorage). Device registration (repeated on `DEVICE_UNKNOWN`). Upload connector completes a batch **only when the server answered every operation**; every other outcome keeps the queue. Revocation also checked before each sync connection (idle devices purge too). One screen: create household (optional GPS), list with state per record, pending notice, **sign-out blocked while writes are queued**, measured local-save and start-up times, SQLCipher version shown. FR/EN.                                                                                                                                                  |

States shown per record: **pending** (saved on the phone, not sent) → **syncing** (batch in flight) →
**synced** (server applied it) / **rejected** (with reason) / **conflict** (with reason). The "pending" state is
written in the same transaction as the record, and any row still in PowerSync's upload queue is shown as pending
whatever else is recorded, so nothing is ever shown as received before the server applied it (OFF-006, RULE-03).

Reviews (definition of done): offline-sync reviewer — 4 blockers (batch-wide 400 dropping good records,
unknown device treated as revoked, status written outside the save, reusable idempotency key) and security
reviewer — 3 should-fixes (download scope, idempotency mismatch, error mapping). **All fixed** as described above.

## 2. Automated results

| Check                                                                                                                                                                                                                                                                                                             | Result                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/sync` unit tests (mapping, op_id-based idempotency key, missing op_id refused, states, reason codes)                                                                                                                                                                                                    | 8 / 8 pass                                     |
| `apps/chw` typecheck, lint, i18n parity                                                                                                                                                                                                                                                                           | pass                                           |
| Android JS bundle (`expo export`)                                                                                                                                                                                                                                                                                 | builds (5 MB Hermes bytecode)                  |
| `expo install --check` (SDK 58 compatibility)                                                                                                                                                                                                                                                                     | up to date                                     |
| pgTAP `supabase/tests/0006_offline_spike.test.sql` (29 assertions: expired-assignment job, mixed batch incl. bad GPS, replay, same key with different payload, foreign operation id, conflicts, catchment move, other catchment update, null coordinates, revoked / unknown / foreign device, wrong device clock) | 29 / 29 pass (CI fresh DB and dev, 2026-11-26) |
| pgTAP `supabase/tests/0007_powersync_least_privilege.test.sql` (14 assertions: publication limited to 3 tables, integration role stripped to 3 tables, connection cap, function not callable by API roles)                                                                                                        | 14 / 14 pass (dev, 2026-11-26)                 |
| All pgTAP files 0001–0006 against dev (rolled back)                                                                                                                                                                                                                                                               | 278 / 278 pass                                 |

## 3. Setup (owner steps, then Claude)

1. **Supabase CLI login with the JoRapha account.** On 2026-11-26 the CLI was signed in to a different
   Supabase account and returned 403 for project `rdozfdblandlqixixczr`. Run `pnpm supabase login` and pick the
   account that owns JoRapha. Then Claude: runs the pgTAP tests, applies `0015`, deploys `sync-ingest`, creates
   the synthetic CHW test account and fixtures.
2. **PowerSync Cloud** (owner — account creation):
   1. Create an account and an instance (EU region; synthetic data only — PowerSync is a data processor, ADR-004).
   2. In the Supabase dashboard SQL editor, enable the replication role with a password you generate (never in
      git, never in chat): `alter role powersync_role with login password '<long random secret>' connection limit 5;`
      Whoever holds this password can read every row of the three published tables: store it only in PowerSync,
      rotate it after the spike, and disable it (`alter role powersync_role nologin;`) when the spike ends.
   3. PowerSync → Database connection: Supabase, user `powersync_role`, that password, database `postgres`,
      SSL verify-full. Use the connection details PowerSync's Supabase guide asks for (direct connection; check
      the IPv4/IPv6 note in that guide).
   4. PowerSync → Client auth: enable **Supabase Auth** for project `rdozfdblandlqixixczr`.
   5. Paste `powersync/sync-rules.yaml` into Sync Rules, validate, deploy. Copy the instance URL.
3. **Expo / EAS** (owner — account and login):
   1. Create or sign in to an Expo account; on this machine: `cd apps/chw`, `npx eas-cli login`, `npx eas-cli init`.
   2. Set EAS environment variables (environment `development`): `EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key, never service_role), `EXPO_PUBLIC_POWERSYNC_URL`.
   3. Build: `npx eas-cli build --profile spike --platform android` (no dev client, closest to real start-up
      times). Install the APK on the test phone from the link EAS prints.
4. **Phone:** the cheapest Android phone available in Bertoua, not an emulator. Record model, Android version,
   RAM, free storage and battery level in §4.

### 3.5 What happened during setup (2026-11-26)

- `0015` and `0016` applied to dev; `sync-ingest` deployed (unauthenticated calls answer 401); synthetic
  account `spike.chw1@jorapha.test` assigned to "Spike catchment Bertoua-Test (synthetic)" via
  `supabase/spike/dev_fixtures.sql`; EAS project `@rektech/jorapha-chw` created, Supabase URL and publishable key
  set as EAS variables (environment `development`).
- **Finding:** PowerSync's Supabase dashboard integration did not use `powersync_role`. It created its own login
  role (`powersync_<id>`) with BYPASSRLS, SELECT on **every** table (patient, clinical, audit, sync, cron) and USAGE
  on every domain schema, and created the `powersync` publication with every table before `0015` ran, so
  `0015`'s three-table publication was skipped. Data on dev is synthetic, so nothing real was exposed. Owner
  decision: restrict in place. Migration `0016` limits the publication to the three spike tables and strips any
  `powersync_*` role to USAGE on `community` + SELECT on the three tables, 5 connections, re-applied every
  30 minutes. Verified on dev after the push. `powersync_role` (0015) stays unused and cannot log in.
- **Gate before staging/production:** never use the PowerSync dashboard's automatic Supabase setup there; connect
  with a role created by migrations, and check the publication and role grants after connecting.

## 4. Fault tests (run on the phone; record what you observe)

Device: model ______ · Android ______ · RAM ______ · free storage ______ · app build ______ · date ______

Before starting: sign in with the test CHW account while online, wait until the catchment appears, and check that
the measurements panel shows **"Local encryption: 4.x…"** (SQLCipher active). Name households `T<test>-<n>`
(e.g. `T1-07`) so server counts are exact. Claude checks the server after each test with:

```sql
select left(name_or_head, 3) as test, count(*), count(distinct name_or_head)
from community.household where origin_device_id = '<device id>' group by 1 order by 1;
```

| #   | Test                       | Steps                                                                                                                                                  | Expected                                                                                                                         | Observed | Pass? |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| 1   | Airplane mode × 20         | Airplane ON. Create `T1-01`…`T1-20` (some with GPS). Note "last local save" for every 5th. Airplane OFF.                                               | All 20 **pending** offline, notice counts 20; then **syncing → synced**. Server: 20 rows, 20 distinct.                           |          |       |
| 2a  | Kill right after save      | Airplane ON. Create `T2-01`, then force-stop the app immediately (Settings → Apps → Force stop). Reopen.                                               | `T2-01` is listed as **pending** (never synced) after reopening.                                                                 |          |       |
| 2b  | Kill mid-upload            | Airplane ON, create `T2-02`…`T2-11`. Airplane OFF and force-stop as soon as the first item shows **syncing**. Reopen, wait.                            | All 10 end **synced**; server exactly 10 (idempotent replay).                                                                    |          |       |
| 3   | Same batch twice           | Airplane ON, create `T3-01`…`T3-03`. Airplane OFF; while items show **syncing**, airplane ON then OFF twice.                                           | Server exactly 3; no duplicates; none shown rejected. (Exact replay is proven by pgTAP.)                                         |          |       |
| 4   | Device clock 2 days wrong  | Automatic time OFF, date 2 days **back**. Create `T4-01`, `T4-02` offline, reconnect. Then 2 days **ahead**: `T4-03`, `T4-04`. Restore automatic time. | Rows sync; server `created_at` = real server time, `client_created_at` = the wrong device time. Note any sign-in / token errors. |          |       |
| 5   | Reboot with pending items  | Airplane ON, create `T5-01`…`T5-05`. Reboot the phone. Open the app (still offline). Then reconnect.                                                   | After reboot the 5 are **pending** (encrypted queue survived); after reconnecting **synced**.                                    |          |       |
| 6   | Sign-out with pending      | Airplane ON, create `T6-01`. Tap **Sign out**.                                                                                                         | Sign-out is refused with the "not sent yet" message; `T6-01` still pending. Reconnect, let it sync, then sign out works.         |          |       |
| 7   | Rejected path              | Airplane ON **first**, create `T7-01`. Then ask Claude to end the assignment on the server. Airplane OFF.                                              | `T7-01` shows **rejected — Outside your catchment**; never synced. Server: 0 rows for T7.                                        |          |       |
| 8   | Unregistered device        | Ask Claude to note the device id, then (as part of 1) confirm the first sync after a fresh install works even with airplane mode on at first launch.   | First upload gets `DEVICE_UNKNOWN`, app registers, retries, items **synced**; nothing erased.                                    |          |       |
| 9   | Revoked device, idle       | With nothing queued, ask Claude to revoke the device (`api.revoke_device`). Wait for the app to reconnect (or reopen it).                              | App shows "device revoked", local data erased, signed out — without any upload.                                                  |          |       |
| 10  | Revoked device, with queue | Fresh sign-in on a new install, create `T10-01` offline, ask Claude to revoke, reconnect.                                                              | Upload refused `DEVICE_REVOKED`; local data erased; message shown.                                                               |          |       |

Timings (performance budget, CLAUDE.md, p95 on a low-cost Android):

| Metric                                                            | Budget     | Samples (ms) | p95 / worst | Within budget? |
| ----------------------------------------------------------------- | ---------- | ------------ | ----------- | -------------- |
| Local save (screen: "last local save")                            | ≤ 3 000 ms |              |             |                |
| Cold start to list (screen: "start-up to list"; force-stop first) | ≤ 5 000 ms |              |             |                |
| Cold start, stopwatch from tapping the icon                       | ≤ 5 000 ms |              |             |                |
| Offline list visible after reopen (stopwatch)                     | ≤ 2 000 ms |              |             |                |

The on-screen start-up time starts when the JavaScript bundle runs; it does not include the native process
start, hence the stopwatch row.

## 5. Problems, risks and gates before real data

1. **Download scope is coarser than the write checks.** PowerSync parameter queries cannot compare dates or check
   the membership/organization status, so downloads are scoped by `chw_assignment.status`. Expired assignments
   are now ended every 15 minutes by a cron job (gap ≤ 15 min). Gate before real data: Sync Streams or an
   equivalent check of membership and organization status on the download path.
2. **Revoked devices and sessions.** The app purges itself on revocation (upload and before each sync
   connection), but a modified client could ignore that while its session is valid. Gate before real data:
   revoking a device must also revoke the user's sessions server-side (Edge Function with `auth.admin.signOut`).
3. **Conflicts drop the CHW's values.** A conflict row records which fields conflicted but not the device's
   values (`client_values_encrypted` is null), and the local row reverts at the next checkpoint. ADR-003 review
   needs the values: store them encrypted before conflicts happen on real data.
4. **Rejected inserts disappear from the local table** after the next checkpoint; the status row keeps the name
   so the CHW sees "rejected" and why, but values must be re-entered. A real form needs a local drafts table.
5. **The publication sends every column** of the three tables (including `created_by`, `origin_device_id`) to
   PowerSync. Restrict with column lists before real data.
6. **Version pins.** `@powersync/react-native` 2.4.1 supports `@op-engineering/op-sqlite` ≥ 17.1 < 19 only;
   op-sqlite 19 also fails the 7-day release-age rule today. The `@powersync/op-sqlite` package named in ADR-002
   (for op-sqlite 13–15) is superseded by the built-in adapter.
7. **PowerSync is a data processor** (replicated rows): DPA and region are part of ADR-004.
8. **Network to the database.** PowerSync needs a direct replication connection; this machine saw intermittent
   database timeouts. Watch the PowerSync dashboard connection status during the tests.
9. **A 403 FORBIDDEN** (e.g. suspended account) keeps the queue and shows the reason, retrying until resolved.

## 6. Recommendation for ADR-002

**Pending device results.** Criteria for **GO**: tests 1, 2a, 2b, 4, 5 and 6 pass with no lost or duplicated
record; tests 7–10 behave as expected; SQLCipher shown active; local save and offline list within budget on the
reference phone; cold start within budget or with a clear, fixable cause. **NO-GO** if any acknowledged local
record is lost, a record is duplicated on the server, a queued record is shown as synced, SQLCipher cannot be
enabled on the device, or timings miss the budget by a wide margin with no fix in sight. Fallback: ADR-002
option 2 (custom sync), keeping the same `sync-ingest` contract.
