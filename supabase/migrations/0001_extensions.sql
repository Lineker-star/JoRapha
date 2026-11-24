-- 0001_extensions.sql — Step 0.2
-- Extensions and empty domain schemas. No tables (they arrive with the ERD in Phase 1).
--
-- Never edit this file after it is merged: add a new migration instead.
-- pgtap is NOT enabled here: it is test-only, so each pgTAP file in supabase/tests creates it inside
-- its own transaction (see tests/0001_schemas.test.sql). That keeps it out of staging and production.

-- ---------------------------------------------------------------------------------------------------
-- Extensions (Supabase convention: the `extensions` schema, never `public`)
-- ---------------------------------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;  -- gen_random_uuid(), digest(), crypt()
create extension if not exists postgis with schema extensions;   -- facility discovery, catchments (TA §4)

-- pg_cron must live in pg_catalog; it creates the `cron` schema for its tables.
create extension if not exists pg_cron with schema pg_catalog;

-- Supabase Queues (ADR-001: replaces Redis jobs). Creates and owns the `pgmq` schema.
create extension if not exists pgmq;

-- ---------------------------------------------------------------------------------------------------
-- Domain schemas — one per module (TA §5). Default deny: no privileges for anon or authenticated.
-- Schemas are NOT added to the Data API (config.toml [api].schemas) until their tables have RLS
-- policies with pgTAP tests.
-- ---------------------------------------------------------------------------------------------------
create schema if not exists identity;
comment on schema identity is 'Accounts, roles, facility memberships, consent and delegated (caregiver) authority.';

create schema if not exists patient;
comment on schema patient is 'Patient and dependant demographics, households, identifiers.';

create schema if not exists provider;
comment on schema provider is 'Clinicians, credentials and verification, facilities and services.';

create schema if not exists scheduling;
comment on schema scheduling is 'Availability, appointments, reminders.';

create schema if not exists clinical;
comment on schema clinical is 'Encounters, observations, diagnoses, prescriptions. Append-only with amendments (RULE-04).';

create schema if not exists referral;
comment on schema referral is 'Referrals and their tracked outcomes.';

create schema if not exists lab;
comment on schema lab is 'Lab orders, specimens, validated result release.';

create schema if not exists pharmacy;
comment on schema pharmacy is 'Prescription validation, dispensing, stock with source and freshness (RULE-08).';

create schema if not exists community;
comment on schema community is 'Community health worker tasks, household visits, field observations.';

create schema if not exists billing;
comment on schema billing is 'Prices, invoices, Mobile Money payments.';

create schema if not exists content;
comment on schema content is 'Health content packs with version, expiry and language metadata (OFF-009).';

create schema if not exists audit;
comment on schema audit is 'Append-only audit trail and patient access history.';

create schema if not exists sync;
comment on schema sync is 'Offline sync ingest: idempotency keys, conflicts, device state (OFF-004, OFF-005).';

-- Explicit default deny. Postgres grants nothing on new schemas to PUBLIC, but stating it guards
-- against future default-privilege changes. Access is granted per table, with RLS, from Phase 1.
do $$
declare
  s text;
begin
  foreach s in array array[
    'identity', 'patient', 'provider', 'scheduling', 'clinical', 'referral', 'lab',
    'pharmacy', 'community', 'billing', 'content', 'audit', 'sync'
  ]
  loop
    execute format('revoke all on schema %I from public, anon, authenticated', s);
  end loop;
end
$$;
