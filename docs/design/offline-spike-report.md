# Offline spike report — Step 1.4 (ADR-002 go / no-go)

Status: **built, device tests not yet run.** The go / no-go recommendation (§6) is filled in only from results
observed on a real phone. Nothing in §4 may be filled in from an emulator or from expectations.

Scope: one entity (`community.household`: name, village, GPS point, member count), CHW app only.
Sources: TA §7 (offline data and sync), PRD §7 (OFF-001…OFF-010), ADR-002, ADR-003.

## 1. What was built

| Part          | Where                                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration     | `supabase/migrations/0015_offline_spike.sql` | `household.member_count`; publication `powersync` (household, catchment, chw_assignment); `powersync_role` (replication, **no password, no login** — enabled by the owner outside git); `api.sync_household_batch`                                                                                                                                                                                                                                                                                                                                                                              |
| Batch ingest  | `api.sync_household_batch(device_id, ops)`   | Runs as the CHW (JWT). Checks active account and **active device of the caller** (else `DEVICE_REVOKED`), batch size 1–100. Per operation, inside one transaction with a savepoint per op: idempotency (replayed key → stored result), catchment (`NOT_IN_CATCHMENT`), schema version, insert or field update, stale `base_row_version` → `STALE_VERSION` conflict, catchment move → `CATCHMENT_CHANGE` conflict, bad values → `INVALID_PAYLOAD`. Writes `sync.operation` (hash only, no payload) and `sync.conflict`. Server time is the record time; device time kept as `client_created_at`. |
| Edge Function | `supabase/functions/sync-ingest`             | Verifies the JWT with Supabase Auth, validates the batch with zod, calls the function above **with the caller's JWT** (no `service_role`), returns per-operation `applied` / `rejected` / `conflict` + reason code. Logs counts only, never payloads.                                                                                                                                                                                                                                                                                                                                           |
| Sync rules    | `powersync/sync-rules.yaml`                  | A CHW downloads the catchments they are actively assigned to and the active households in them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Shared logic  | `packages/sync/src/households.ts` (+ tests)  | CRUD entry → ingest operation (stable idempotency key `deviceId:clientId`), server result → UI state, reason codes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CHW app       | `apps/chw`                                   | SQLCipher database via `@powersync/react-native` 2.4.1 + `@op-engineering/op-sqlite` 18.2.5, key = 256 random bits generated on first launch and kept only in `expo-secure-store`; Supabase session in chunked secure storage (never AsyncStorage); device registration; upload connector; one screen: create household (optional GPS), list with state per record, pending notice, measured local-save and start-up times. FR/EN.                                                                                                                                                              |

States shown per record: **pending** (saved on the phone, not sent) → **syncing** (batch in flight) →
**synced** (server applied it) / **rejected** (with reason) / **conflict** (with reason). Nothing is shown as
received before the server applied it (OFF-006, RULE-03).

## 2. Automated results

| Check                                                                                                                                                           | Result                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `packages/sync` unit tests (mapping, idempotency key, states, reason codes)                                                                                     | 7 / 7 pass                      |
| `apps/chw` typecheck, lint, i18n parity                                                                                                                         | pass                            |
| Android JS bundle (`expo export`)                                                                                                                               | builds (5 MB Hermes bytecode)   |
| `expo install --check` (SDK 58 compatibility)                                                                                                                   | up to date                      |
| pgTAP `supabase/tests/0006_offline_spike.test.sql` (19 assertions: mixed batch, replay, conflict, catchment move, revoked / foreign device, wrong device clock) | **not yet run** — see §5 step 1 |

## 3. Setup (owner steps, then Claude)

1. **Supabase CLI login with the JoRapha account.** On 2026-11-26 the CLI was signed in to a different
   Supabase account and returned 403 for project `rdozfdblandlqixixczr`. Run `pnpm supabase login` and pick the
   account that owns JoRapha. Then Claude: runs the pgTAP tests, applies `0015`, deploys `sync-ingest`, creates
   the synthetic CHW test account and fixtures.
2. **PowerSync Cloud** (owner — account creation):
   1. Create an account and a project/instance (choose an EU region; synthetic data only, see ADR-004).
   2. In the Supabase dashboard SQL editor, give the replication role a password you generate (never in git):
      `alter role powersync_role with login password '<long random secret>';`
   3. PowerSync → Database connection: Supabase, user `powersync_role`, that password, database `postgres`,
      SSL verify-full. Use the connection details PowerSync's Supabase guide asks for (direct connection; check
      the IPv4/IPv6 note in that guide).
   4. PowerSync → Client auth: enable **Supabase Auth** for project `rdozfdblandlqixixczr`.
   5. Paste `powersync/sync-rules.yaml` into Sync Rules, validate, deploy.
   6. Copy the instance URL.
3. **Expo / EAS** (owner — account and login):
   1. Create or sign in to an Expo account; on this machine: `cd apps/chw`, `npx eas-cli login`, `npx eas-cli init`.
   2. Set EAS environment variables (environment `development`): `EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key, never service_role), `EXPO_PUBLIC_POWERSYNC_URL`.
   3. Build: `npx eas-cli build --profile spike --platform android` (no dev client, closest to real start-up
      times). Install the APK on the test phone from the link EAS prints.
4. **Phone:** the cheapest Android phone available in Bertoua, not an emulator. Record model, Android version,
   RAM, free storage and battery level in §4.

## 4. Fault tests (run on the phone; record what you observe)

Device: model ______ · Android ______ · RAM ______ · free storage ______ · app build ______ · date ______

Sign in with the test CHW account while online, wait until the catchment appears, then:

| #   | Test                      | Steps                                                                                                                                                                        | Expected                                                                                                                                              | Observed | Pass? |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----- |
| 1   | Airplane mode × 20        | Airplane mode ON. Create 20 households (vary names, some with GPS). Note the "last local save" time for each 5th. Airplane mode OFF.                                         | All 20 show **pending** offline, the pending notice counts 20; after reconnecting they go **syncing → synced**; 20 rows on the server, no duplicates. |          |       |
| 2   | Kill app mid-upload       | Airplane mode ON, create 10. Turn network ON and **within ~1 s** force-stop the app (Settings → Apps → Force stop). Reopen.                                                  | Nothing lost: after reopening, the 10 finish as **synced**; server has exactly 10 (idempotency).                                                      |          |       |
| 3   | Same batch twice          | Covered server-side by pgTAP (replay). On the phone: create 3 offline, reconnect, and while syncing toggle airplane mode on/off twice.                                       | Server has exactly 3; any replayed operation returns its first result; no duplicates.                                                                 |          |       |
| 4   | Device clock 2 days wrong | Settings → Date & time: automatic OFF, set the date 2 days **back**. Create 2 households offline, reconnect. Repeat with the clock 2 days **ahead**. Restore automatic time. | Rows sync; on the server `created_at` = real server time and `client_created_at` = the wrong device time. Note any sign-in / token errors.            |          |       |
| 5   | Reboot with pending items | Airplane mode ON, create 5. Reboot the phone. Open the app (still offline). Then reconnect.                                                                                  | After reboot the 5 are still listed as **pending** (encrypted queue survived); after reconnecting they become **synced**.                             |          |       |
| —   | Rejected path             | Ask Claude to end the CHW's catchment assignment on the server, then create a household for that catchment offline and reconnect.                                            | The record shows **rejected — Outside your catchment**, not synced.                                                                                   |          |       |
| —   | Revoked device            | Ask Claude to revoke the device (`api.revoke_device`), then reconnect.                                                                                                       | Upload refused with `DEVICE_REVOKED`; local data erased; message shown.                                                                               |          |       |

Timings (performance budget, CLAUDE.md, p95 on a low-cost Android):

| Metric                                                            | Budget     | Samples (ms) | p95 / worst | Within budget? |
| ----------------------------------------------------------------- | ---------- | ------------ | ----------- | -------------- |
| Local save (screen: "last local save")                            | ≤ 3 000 ms |              |             |                |
| Cold start to list (screen: "start-up to list"; force-stop first) | ≤ 5 000 ms |              |             |                |
| Offline list visible after reopen (stopwatch)                     | ≤ 2 000 ms |              |             |                |

Note: the on-screen start-up time starts when the JavaScript bundle runs; it does not include the native process
start. Also time one cold start with a stopwatch from tapping the icon.

## 5. Problems and risks found while building

1. **Sync-rule scope is coarser than the write checks.** PowerSync parameter queries cannot compare
   `valid_from`/`valid_to` with the current time or check the CHW's membership/organization status, so downloads
   are scoped by `chw_assignment.status` only. Writes are fully checked in Postgres. Revisit with PowerSync Sync
   Streams before real data; until then end assignments by status, not by date.
2. **Rejected inserts disappear from the local table** after the next checkpoint (the server does not have
   them). The status row keeps the name so the CHW sees "rejected" and why, but the entered values must be
   re-entered. Acceptable for the spike; a real form needs a local "drafts" table.
3. **Version pins.** `@powersync/react-native` 2.4.1 supports `@op-engineering/op-sqlite` ≥ 17.1 < 19 only;
   op-sqlite 19 also fails the 7-day release-age rule today. The older `@powersync/op-sqlite` package (named in
   ADR-002) is for op-sqlite 13–15 and is superseded by the built-in adapter.
4. **PowerSync is a data processor.** PowerSync Cloud receives replicated rows; DPA and region are part of
   ADR-004 before any real data.
5. **Network to the database.** PowerSync needs a direct (replication) connection to Postgres; this machine
   saw intermittent database-connection timeouts during development. Check the connection status in the
   PowerSync dashboard during the tests.
6. **Cold-start measurement** excludes native start (see §4 note).

## 6. Recommendation for ADR-002

**Pending device results.** Criteria for **GO**: tests 1, 2, 4 and 5 pass with no lost or duplicated record;
the rejected and revoked paths behave as expected; local save and offline list within budget on the reference
phone; cold start within budget or with a clear, fixable cause. **NO-GO** if any acknowledged local record is
lost, a record is duplicated on the server, SQLCipher cannot be enabled on the device, or timings miss the
budget by a wide margin with no fix in sight; the fallback is ADR-002 option 2 (custom sync), keeping the same
`sync-ingest` contract.
