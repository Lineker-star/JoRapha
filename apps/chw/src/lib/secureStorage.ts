import * as SecureStore from 'expo-secure-store';

// Android Keystore-backed storage. SecureStore values should stay under ~2 KB, so larger values (the Supabase
// session) are split into chunks. Nothing sensitive is ever written to AsyncStorage (PRD OFF-007).
const CHUNK = 1800;
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`, options);
    if (count === null) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, options);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await this.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), options);
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count), options);
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`, options);
    if (count === null) return;
    for (let i = 0; i < Number(count); i++) await SecureStore.deleteItemAsync(`${k}.${i}`, options);
    await SecureStore.deleteItemAsync(`${k}.n`, options);
  },
};
