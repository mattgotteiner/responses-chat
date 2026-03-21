import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';
import { SETTINGS_STORAGE_KEY } from './localStorage';

const { storedKeys, fakeCryptoKey } = vi.hoisted(() => ({
  storedKeys: new Map<string, CryptoKey>(),
  fakeCryptoKey: {} as CryptoKey,
}));

vi.mock('dexie', () => {
  class DexieMock {
    public keyEntries!: {
      get: (name: string) => Promise<{ name: string; key: CryptoKey } | undefined>;
      put: (entry: { name: string; key: CryptoKey }) => Promise<string>;
      delete: (name: string) => Promise<void>;
    };

    public constructor(name: string) {
      void name;
    }

    public version(version: number) {
      void version;
      return {
        stores: vi.fn(() => {
          this.keyEntries = {
            get: vi.fn(async (name: string) => {
              const key = storedKeys.get(name);
              return key ? { name, key } : undefined;
            }),
            put: vi.fn(async ({ name, key }: { name: string; key: CryptoKey }) => {
              storedKeys.set(name, key);
              return name;
            }),
            delete: vi.fn(async (name: string) => {
              storedKeys.delete(name);
            }),
          };
        }),
      };
    }
  }

  return { default: DexieMock };
});

function xorBytes(input: BufferSource): ArrayBuffer {
  const bytes =
    input instanceof Uint8Array
      ? input
      : input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

  return Uint8Array.from(bytes, byte => byte ^ 0xaa).buffer;
}

describe('settingsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    storedKeys.clear();

    const subtleCrypto = {
      generateKey: vi.fn(
        async (
          algorithm: AlgorithmIdentifier,
          extractable: boolean,
          keyUsages: readonly KeyUsage[]
        ) => {
          void algorithm;
          void extractable;
          void keyUsages;
          return fakeCryptoKey;
        }
      ),
      encrypt: vi.fn(async (_algorithm: unknown, _key: CryptoKey, data: BufferSource) =>
        xorBytes(data)
      ),
      decrypt: vi.fn(async (_algorithm: unknown, _key: CryptoKey, data: BufferSource) =>
        xorBytes(data)
      ),
    } as unknown as SubtleCrypto;

    const webCrypto = {
      getRandomValues: (<T extends ArrayBufferView>(array: T): T => {
        if (array instanceof Uint8Array) {
          array.set(Array.from({ length: array.length }, (_, index) => index + 1));
        }

        return array;
      }) as Crypto['getRandomValues'],
      subtle: subtleCrypto,
    } as Crypto;

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webCrypto,
    });
  });

  it('reads legacy plaintext settings snapshots for migration', async () => {
    const legacySettings = {
      ...DEFAULT_SETTINGS,
      endpoint: 'https://example.openai.azure.com',
      apiKey: 'plain-text-key',
      theme: 'dark' as const,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(legacySettings));

    const { readStoredSettingsSnapshot, hydrateStoredApiKey } = await import('./settingsStorage');
    const snapshot = readStoredSettingsSnapshot();

    expect(snapshot.isLegacyPlaintext).toBe(true);
    expect(snapshot.hasEncryptedApiKey).toBe(false);
    expect(snapshot.settings.endpoint).toBe('https://example.openai.azure.com');
    expect(await hydrateStoredApiKey()).toBe('plain-text-key');
  });

  it('encrypts the API key before storing settings in localStorage', async () => {
    const { persistStoredSettings } = await import('./settingsStorage');

    await persistStoredSettings({
      ...DEFAULT_SETTINGS,
      endpoint: 'https://example.openai.azure.com',
      apiKey: 'super-secret-key',
      theme: 'dark',
    });

    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);

    expect(stored).toBeTruthy();
    expect(stored).not.toContain('super-secret-key');

    const parsed = JSON.parse(stored ?? '{}') as {
      settings: { endpoint: string; theme: string };
      encryptedApiKey?: { algorithm: string; iv: string; ciphertext: string };
    };

    expect(parsed.settings.endpoint).toBe('https://example.openai.azure.com');
    expect(parsed.settings.theme).toBe('dark');
    expect(parsed.encryptedApiKey).toMatchObject({
      algorithm: 'AES-GCM',
    });
  });

  it('hydrates an encrypted API key back into plaintext for runtime use', async () => {
    const { hydrateStoredApiKey, persistStoredSettings, readStoredSettingsSnapshot } =
      await import('./settingsStorage');

    await persistStoredSettings({
      ...DEFAULT_SETTINGS,
      endpoint: 'https://example.openai.azure.com',
      apiKey: 'rehydrated-key',
    });

    const snapshot = readStoredSettingsSnapshot();

    expect(snapshot.hasEncryptedApiKey).toBe(true);
    expect(snapshot.settings.apiKey).toBe('');
    expect(await hydrateStoredApiKey()).toBe('rehydrated-key');
  });

  it('clears both the stored settings record and the persisted encryption key', async () => {
    const { clearStoredSettings, persistStoredSettings } = await import('./settingsStorage');

    await persistStoredSettings({
      ...DEFAULT_SETTINGS,
      endpoint: 'https://example.openai.azure.com',
      apiKey: 'clear-me',
    });

    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();
    expect(storedKeys.size).toBe(1);

    await clearStoredSettings();

    expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(storedKeys.size).toBe(0);
  });
});
