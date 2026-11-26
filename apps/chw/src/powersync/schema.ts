import { column, Schema, Table } from '@powersync/react-native';

// Synced from Postgres by the sync rules in powersync/sync-rules.yaml.
const catchments = new Table({
  name: column.text,
});

const households = new Table(
  {
    catchment_id: column.text,
    name_or_head: column.text,
    village: column.text,
    lat: column.real,
    lng: column.real,
    member_count: column.integer,
    row_version: column.integer, // server version (synced)
    base_row_version: column.integer, // client-only: version an edit was based on (sent with PATCH)
    client_created_at: column.text, // device-reported, never audit time
    op_id: column.text, // client-only: operation id of the last local write
  },
  { indexes: { by_catchment: ['catchment_id'] } },
);

// Local-only: the sync state shown in the UI per record (pending, syncing, synced, rejected, conflict).
const household_sync_status = new Table(
  {
    state: column.text,
    reason_code: column.text,
    label: column.text,
    updated_at: column.text,
  },
  { localOnly: true },
);

export const AppSchema = new Schema({ catchments, households, household_sync_status });

export type HouseholdRow = {
  id: string;
  catchment_id: string | null;
  name_or_head: string | null;
  village: string | null;
  lat: number | null;
  lng: number | null;
  member_count: number | null;
  row_version: number | null;
  client_created_at: string | null;
};
