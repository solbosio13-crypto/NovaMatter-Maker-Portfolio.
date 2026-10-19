import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';

/**
 * Encrypted on-device vault for sensitive NovaLens data (imported statements, finance summaries).
 *
 * - AES-256-GCM via expo-crypto. The key is generated on the device and kept in the iOS Keychain
 *   (WHEN_UNLOCKED_THIS_DEVICE_ONLY): it never syncs to iCloud, never leaves this iPhone, and
 *   cannot be read while the phone is locked.
 * - Only ciphertext is written to app storage. A tampered or undecryptable record is deleted, not shown.
 * - On web there is no hardware keychain, so vault data lives in memory for the session only.
 * - wipeVault() destroys the key, which makes every sealed record unreadable even if a copy survives.
 */

const KEY_NAME = 'novalens.vault.aes.v1';
const PREFIX = 'novalens.vault.';
const memory = new Map<string, string>();
let keyPromise: Promise<AESEncryptionKey> | null = null;

async function vaultKey(): Promise<AESEncryptionKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existing = await SecureStore.getItemAsync(KEY_NAME);
      if (existing) return AESEncryptionKey.import(existing, 'hex');
      const created = await AESEncryptionKey.generate();
      await SecureStore.setItemAsync(KEY_NAME, await created.encoded('hex'), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return created;
    })().catch(error => {
      keyPromise = null;
      throw error;
    });
  }
  return keyPromise;
}

export async function sealJSON(name: string, value: unknown): Promise<void> {
  const plaintext = JSON.stringify(value);
  if (Platform.OS === 'web') {
    memory.set(name, plaintext);
    return;
  }
  const sealed = await aesEncryptAsync(new TextEncoder().encode(plaintext), await vaultKey());
  const combined = await sealed.combined('base64');
  if (typeof combined !== 'string') throw new Error('vault_encoding_failed');
  await AsyncStorage.setItem(PREFIX + name, combined);
}

export async function openJSON<T>(name: string): Promise<T | null> {
  if (Platform.OS === 'web') {
    const raw = memory.get(name);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  const stored = await AsyncStorage.getItem(PREFIX + name);
  if (!stored) return null;
  try {
    const plaintext = await aesDecryptAsync(AESSealedData.fromCombined(stored), await vaultKey());
    return JSON.parse(new TextDecoder().decode(plaintext as Uint8Array)) as T;
  } catch {
    await AsyncStorage.removeItem(PREFIX + name);
    return null;
  }
}

export async function removeSealed(name: string): Promise<void> {
  memory.delete(name);
  await AsyncStorage.removeItem(PREFIX + name);
}

/** Deletes every vault record and destroys the key. */
export async function wipeVault(): Promise<void> {
  memory.clear();
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY_NAME);
  keyPromise = null;
}
