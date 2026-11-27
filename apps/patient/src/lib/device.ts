import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { secureStorage } from './secureStorage';
import { supabase } from './supabase';

const KEY_DEVICE = 'jorapha.device.id';

/** Stable id of this install (unit of revocation, identity.device_registration). */
export async function getDeviceId(): Promise<string> {
  const existing = await secureStorage.getItem(KEY_DEVICE);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await secureStorage.setItem(KEY_DEVICE, id);
  return id;
}

/** Registers this install for the signed-in user at first sign-in (api.register_device). Best effort. */
export async function registerDevice(): Promise<void> {
  const { error } = await supabase.schema('api').rpc('register_device', {
    p_device_id: await getDeviceId(),
    p_app: 'patient',
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw error;
}
