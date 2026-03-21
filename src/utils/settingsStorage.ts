/**
 * Settings storage utilities for encrypted API key persistence.
 */

import Dexie, { type Table } from 'dexie';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { SETTINGS_STORAGE_KEY } from './localStorage';

const SETTINGS_STORAGE_VERSION = 1;
const SETTINGS_KEY_DATABASE_NAME = 'responses-chat-secure-settings';
const SETTINGS_KEY_NAME = 'azure-openai-api-key';
const AES_GCM_IV_LENGTH = 12;

interface EncryptedApiKeyPayload {
  version: number;
  algorithm: 'AES-GCM';
  iv: string;
  ciphertext: string;
}

interface PersistedSettingsRecord {
  version: number;
  settings: Omit<Settings, 'apiKey'>;
  encryptedApiKey?: EncryptedApiKeyPayload;
}

interface SettingsKeyEntry {
  name: string;
  key: CryptoKey;
}

export interface StoredSettingsSnapshot {
  settings: Settings;
  hasEncryptedApiKey: boolean;
  isLegacyPlaintext: boolean;
}

class SettingsKeyDatabase extends Dexie {
  keyEntries!: Table<SettingsKeyEntry, string>;

  public constructor() {
    super(SETTINGS_KEY_DATABASE_NAME);
    this.version(1).stores({
      keyEntries: '&name',
    });
  }
}

const settingsKeyDatabase = new SettingsKeyDatabase();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStoredJsonValue(): unknown {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored === null ? null : JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
}

function mergeStoredSettings(stored: Partial<Settings>): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  if (merged.noLocalStorage) {
    return { ...DEFAULT_SETTINGS, noLocalStorage: true };
  }

  return merged;
}

function isEncryptedApiKeyPayload(value: unknown): value is EncryptedApiKeyPayload {
  return (
    isRecord(value) &&
    value['algorithm'] === 'AES-GCM' &&
    typeof value['iv'] === 'string' &&
    typeof value['ciphertext'] === 'string'
  );
}

function isPersistedSettingsRecord(value: unknown): value is PersistedSettingsRecord {
  return (
    isRecord(value) &&
    value['version'] === SETTINGS_STORAGE_VERSION &&
    isRecord(value['settings']) &&
    (value['encryptedApiKey'] === undefined || isEncryptedApiKeyPayload(value['encryptedApiKey']))
  );
}

function uint8ArrayToBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Uint8Array(bytes.buffer.slice(0));
}

function getWebCrypto(): Crypto {
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error('Web Crypto API is unavailable.');
  }

  return globalThis.crypto;
}

async function getStoredEncryptionKey(): Promise<CryptoKey | undefined> {
  return settingsKeyDatabase.keyEntries.get(SETTINGS_KEY_NAME).then(entry => entry?.key);
}

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const existingKey = await getStoredEncryptionKey();
  if (existingKey) {
    return existingKey;
  }

  const key = await getWebCrypto().subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );

  await settingsKeyDatabase.keyEntries.put({
    name: SETTINGS_KEY_NAME,
    key,
  });

  return key;
}

async function encryptApiKey(apiKey: string): Promise<EncryptedApiKeyPayload> {
  const webCrypto = getWebCrypto();
  const key = await getOrCreateEncryptionKey();
  const iv = webCrypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const encodedApiKey = new TextEncoder().encode(apiKey);
  const ciphertext = await webCrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedApiKey
  );

  return {
    version: SETTINGS_STORAGE_VERSION,
    algorithm: 'AES-GCM',
    iv: uint8ArrayToBase64(iv),
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptApiKey(payload: EncryptedApiKeyPayload): Promise<string> {
  const key = await getStoredEncryptionKey();
  if (!key) {
    throw new Error('No stored encryption key is available.');
  }

  const decrypted = await getWebCrypto().subtle.decrypt(
    {
      name: payload.algorithm,
      iv: base64ToUint8Array(payload.iv),
    },
    key,
    base64ToUint8Array(payload.ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}

export function readStoredSettingsSnapshot(): StoredSettingsSnapshot {
  const storedValue = getStoredJsonValue();
  if (!storedValue) {
    return {
      settings: DEFAULT_SETTINGS,
      hasEncryptedApiKey: false,
      isLegacyPlaintext: false,
    };
  }

  if (isPersistedSettingsRecord(storedValue)) {
    const mergedSettings = mergeStoredSettings(storedValue.settings);

    return {
      settings: mergedSettings,
      hasEncryptedApiKey:
        !mergedSettings.noLocalStorage && storedValue.encryptedApiKey !== undefined,
      isLegacyPlaintext: false,
    };
  }

  if (isRecord(storedValue)) {
    return {
      settings: mergeStoredSettings(storedValue as Partial<Settings>),
      hasEncryptedApiKey: false,
      isLegacyPlaintext: true,
    };
  }

  return {
    settings: DEFAULT_SETTINGS,
    hasEncryptedApiKey: false,
    isLegacyPlaintext: false,
  };
}

export async function hydrateStoredApiKey(): Promise<string> {
  const storedValue = getStoredJsonValue();
  if (!storedValue) {
    return DEFAULT_SETTINGS.apiKey;
  }

  if (isPersistedSettingsRecord(storedValue)) {
    if (!storedValue.encryptedApiKey) {
      return DEFAULT_SETTINGS.apiKey;
    }

    return decryptApiKey(storedValue.encryptedApiKey);
  }

  if (isRecord(storedValue) && typeof storedValue['apiKey'] === 'string') {
    return storedValue['apiKey'];
  }

  return DEFAULT_SETTINGS.apiKey;
}

export async function persistStoredSettings(settings: Settings): Promise<void> {
  const { apiKey, ...publicSettings } = settings;
  const encryptedApiKey =
    apiKey.trim() === '' ? undefined : await encryptApiKey(apiKey);

  const record: PersistedSettingsRecord = {
    version: SETTINGS_STORAGE_VERSION,
    settings: publicSettings,
    encryptedApiKey,
  };

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(record));
}

export async function clearStoredSettings(): Promise<void> {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  await settingsKeyDatabase.keyEntries.delete(SETTINGS_KEY_NAME);
}
