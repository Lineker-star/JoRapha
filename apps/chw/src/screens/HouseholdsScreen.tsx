import { usePowerSync, useQuery, useStatus } from '@powersync/react-native';
import { KNOWN_REASON_CODES, type ReasonCode, type SyncState } from '@jorapha/sync';
import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markListVisible } from '../metrics';
import { setStatus } from '../powersync/connector';
import { getCipherVersion } from '../powersync/database';

type Row = {
  id: string;
  name_or_head: string | null;
  village: string | null;
  member_count: number | null;
  lat: number | null;
  state: SyncState | null;
  reason_code: string | null;
};

const STATE_STYLE: Record<SyncState, string> = {
  pending: 'bg-amber-100 text-amber-900',
  syncing: 'bg-sky-100 text-sky-900',
  synced: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-900',
  conflict: 'bg-orange-100 text-orange-900',
};

export function HouseholdsScreen({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation();
  const db = usePowerSync();
  const status = useStatus();

  const { data: catchments } = useQuery<{ id: string; name: string }>(
    'SELECT id, name FROM catchments ORDER BY name',
  );
  // A row still in PowerSync's upload queue (ps_crud) is never shown as synced, whatever its status row says;
  // only rows the server sent us (not in the queue, no status) default to "synced".
  const { data: rows } = useQuery<Row>(
    `SELECT h.id, h.name_or_head, h.village, h.member_count, h.lat,
            CASE
              WHEN EXISTS (SELECT 1 FROM ps_crud c WHERE json_extract(c.data, '$.id') = h.id)
                THEN CASE WHEN s.state IN ('syncing', 'rejected', 'conflict') THEN s.state ELSE 'pending' END
              ELSE coalesce(s.state, 'synced')
            END AS state,
            s.reason_code
       FROM households h LEFT JOIN household_sync_status s ON s.id = h.id
     UNION ALL
     SELECT s.id, s.label, NULL, NULL, NULL, s.state, s.reason_code
       FROM household_sync_status s WHERE s.id NOT IN (SELECT id FROM households)
     ORDER BY 1`,
  );

  const [chosenCatchmentId, setCatchmentId] = useState<string | null>(null);
  const catchmentId = chosenCatchmentId ?? catchments[0]?.id ?? null;
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [members, setMembers] = useState('');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [saveMs, setSaveMs] = useState<number | null>(null);
  // Measured once, when the list screen first renders.
  const [coldStartMs] = useState<number | null>(() => markListVisible());
  const syncFailing = Boolean(status.downloadError ?? status.uploadError);
  const noCatchment = catchments.length === 0;
  const { data: queue } = useQuery<{ n: number }>('SELECT count(*) AS n FROM ps_crud');
  const queued = queue[0]?.n ?? 0;
  const [signOutBlocked, setSignOutBlocked] = useState(false);

  function requestSignOut() {
    // Signing out erases the local database: never while writes are still waiting for the server.
    if (queued > 0) {
      setSignOutBlocked(true);
      return;
    }
    onSignOut();
  }

  async function captureGps() {
    setGpsFailed(false);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return setGpsFailed(true);
    try {
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ lat: fix.coords.latitude, lng: fix.coords.longitude });
    } catch {
      setGpsFailed(true);
    }
  }

  async function save() {
    if (!catchmentId) return; // the form explains why and the button is disabled
    const count = Number(members);
    if (
      name.trim().length === 0 ||
      members.trim().length === 0 ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > 100
    ) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const id = Crypto.randomUUID();
    const started = performance.now();
    await db.writeTransaction(async (tx) => {
      await tx.execute(
        `INSERT INTO households (id, catchment_id, name_or_head, village, lat, lng, member_count, client_created_at, op_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          catchmentId,
          name.trim(),
          village.trim() || null,
          position?.lat ?? null,
          position?.lng ?? null,
          count,
          new Date().toISOString(),
          Crypto.randomUUID(),
        ],
      );
      // Same transaction: a record can never exist locally without its "pending" state.
      await setStatus(tx, id, 'pending', null, name.trim());
    });
    setSaveMs(Math.round(performance.now() - started));
    setName('');
    setVillage('');
    setMembers('');
    setPosition(null);
  }

  const pending = rows.filter((r) => r.state === 'pending' || r.state === 'syncing').length;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerClassName="gap-3 px-4 pb-10"
        ListHeaderComponent={
          <View className="gap-3 pt-4">
            <View className="flex-row items-center justify-between">
              <Text accessibilityRole="header" className="text-2xl font-bold text-ink-900">
                {t('chw.households.title')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={requestSignOut}
                className="min-h-12 justify-center px-2"
              >
                <Text className="text-brand-700">{t('chw.households.signOut')}</Text>
              </Pressable>
            </View>
            {signOutBlocked && queued > 0 ? (
              <Text className="rounded-lg bg-red-50 p-3 text-red-900">
                {t('chw.households.pendingSignOut', { count: queued })}
              </Text>
            ) : null}
            <Text className="text-ink-600">
              {status.connected ? t('sync.online') : t('sync.offline')}
            </Text>
            {syncFailing ? (
              <Text className="rounded-lg bg-red-50 p-3 text-red-900">{t('sync.failing')}</Text>
            ) : null}
            <Text className="text-ink-600">
              {t('sync.lastSync', {
                time: status.lastSyncedAt ? status.lastSyncedAt.toLocaleString() : t('sync.never'),
              })}
            </Text>
            {pending > 0 ? (
              <Text className="rounded-lg bg-amber-50 p-3 text-amber-900">
                {t('sync.pendingNotice', { count: pending })}
              </Text>
            ) : null}

            <View className="gap-2 rounded-xl border border-ink-200 p-3">
              <Text className="font-semibold text-ink-900">{t('chw.households.add')}</Text>
              {noCatchment ? (
                <Text className="rounded-lg bg-amber-50 p-3 text-amber-900">
                  {status.hasSynced
                    ? t('chw.households.noCatchment')
                    : t('chw.households.catchmentNotSynced')}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {catchments.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: c.id === catchmentId }}
                      onPress={() => setCatchmentId(c.id)}
                      className={`min-h-12 justify-center rounded-full px-4 ${c.id === catchmentId ? 'bg-brand-600' : 'bg-ink-100'}`}
                    >
                      <Text className={c.id === catchmentId ? 'text-white' : 'text-ink-900'}>
                        {c.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput
                accessibilityLabel={t('chw.households.name')}
                placeholder={t('chw.households.name')}
                value={name}
                onChangeText={setName}
                className="min-h-12 rounded-lg border border-ink-200 px-3"
              />
              <TextInput
                accessibilityLabel={t('chw.households.village')}
                placeholder={t('chw.households.village')}
                value={village}
                onChangeText={setVillage}
                className="min-h-12 rounded-lg border border-ink-200 px-3"
              />
              <TextInput
                accessibilityLabel={t('chw.households.memberCount')}
                placeholder={t('chw.households.memberCount')}
                keyboardType="number-pad"
                value={members}
                onChangeText={setMembers}
                className="min-h-12 rounded-lg border border-ink-200 px-3"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void captureGps()}
                className="min-h-12 justify-center"
              >
                <Text className="text-brand-700">
                  {position
                    ? t('chw.households.gpsCaptured')
                    : gpsFailed
                      ? t('chw.households.gpsUnavailable')
                      : t('chw.households.captureGps')}
                </Text>
              </Pressable>
              {invalid ? <Text className="text-red-700">{t('chw.households.invalid')}</Text> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: noCatchment }}
                disabled={noCatchment}
                onPress={() => void save()}
                className={`min-h-12 items-center justify-center rounded-xl ${noCatchment ? 'bg-ink-300' : 'bg-brand-600 active:bg-brand-700'}`}
              >
                <Text className="font-semibold text-white">{t('chw.households.save')}</Text>
              </Pressable>
            </View>

            <View className="rounded-lg bg-ink-50 p-3">
              <Text className="font-semibold text-ink-900">{t('chw.metrics.title')}</Text>
              {saveMs !== null ? (
                <Text className="text-ink-700">{t('chw.metrics.localSave', { ms: saveMs })}</Text>
              ) : null}
              <Text className="text-ink-700">
                {coldStartMs === null
                  ? t('chw.metrics.coldStartNotMeasured')
                  : t('chw.metrics.coldStart', { ms: coldStartMs })}
              </Text>
              <Text className="text-ink-700">
                {t('chw.metrics.encryption', { version: getCipherVersion() ?? '?' })}
              </Text>
            </View>
            {rows.length === 0 ? (
              <Text className="text-ink-600">{t('chw.households.empty')}</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const state = item.state ?? 'synced';
          const reason: ReasonCode | 'UNKNOWN' | null =
            item.reason_code === null
              ? null
              : (KNOWN_REASON_CODES as readonly string[]).includes(item.reason_code)
                ? (item.reason_code as ReasonCode)
                : 'UNKNOWN';
          return (
            <View className="gap-1 rounded-xl border border-ink-200 p-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold text-ink-900">{item.name_or_head}</Text>
                <Text
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATE_STYLE[state]}`}
                >
                  {t(`sync.state.${state}`)}
                </Text>
              </View>
              {item.village ? <Text className="text-ink-600">{item.village}</Text> : null}
              {item.member_count !== null ? (
                <Text className="text-ink-600">
                  {t('chw.households.memberCountValue', { count: item.member_count })}
                </Text>
              ) : null}
              {reason ? <Text className="text-red-800">{t(`sync.reason.${reason}`)}</Text> : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
