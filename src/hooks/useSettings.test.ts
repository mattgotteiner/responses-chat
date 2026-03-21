/**
 * Tests for useSettings hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from './useSettings';
import { DEFAULT_SETTINGS } from '../types';

const storageMocks = vi.hoisted(() => ({
  snapshot: null as {
    settings: typeof DEFAULT_SETTINGS;
    hasEncryptedApiKey: boolean;
    isLegacyPlaintext: boolean;
  } | null,
  hydrateStoredApiKey: vi.fn(async () => ''),
  persistStoredSettings: vi.fn(async () => {}),
  clearStoredSettings: vi.fn(async () => {}),
}));

vi.mock('../utils/settingsStorage', () => ({
  readStoredSettingsSnapshot: vi.fn(() => {
    if (!storageMocks.snapshot) {
      throw new Error('Test storage snapshot was not initialized.');
    }

    return storageMocks.snapshot;
  }),
  hydrateStoredApiKey: storageMocks.hydrateStoredApiKey,
  persistStoredSettings: storageMocks.persistStoredSettings,
  clearStoredSettings: storageMocks.clearStoredSettings,
}));

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    storageMocks.snapshot = {
      settings: DEFAULT_SETTINGS,
      hasEncryptedApiKey: false,
      isLegacyPlaintext: false,
    };
    storageMocks.hydrateStoredApiKey.mockReset();
    storageMocks.hydrateStoredApiKey.mockResolvedValue(DEFAULT_SETTINGS.apiKey);
    storageMocks.persistStoredSettings.mockReset();
    storageMocks.persistStoredSettings.mockResolvedValue(undefined);
    storageMocks.clearStoredSettings.mockReset();
    storageMocks.clearStoredSettings.mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('basic functionality', () => {
    it('returns default settings when browser storage is empty', () => {
      const { result } = renderHook(() => useSettings());

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
      expect(result.current.isHydrated).toBe(true);
    });

    it('loads settings from the stored snapshot on initialization', () => {
      storageMocks.snapshot = {
        settings: { ...DEFAULT_SETTINGS, endpoint: 'https://test.openai.azure.com' },
        hasEncryptedApiKey: false,
        isLegacyPlaintext: true,
      };

      const { result } = renderHook(() => useSettings());

      expect(result.current.settings.endpoint).toBe('https://test.openai.azure.com');
    });

    it('hydrates an encrypted API key asynchronously when needed', async () => {
      storageMocks.snapshot = {
        settings: { ...DEFAULT_SETTINGS, endpoint: 'https://test.openai.azure.com', apiKey: '' },
        hasEncryptedApiKey: true,
        isLegacyPlaintext: false,
      };
      storageMocks.hydrateStoredApiKey.mockResolvedValue('hydrated-secret');

      const { result } = renderHook(() => useSettings());

      expect(result.current.isHydrated).toBe(false);
      expect(result.current.settings.apiKey).toBe('');

      await waitFor(() => {
        expect(result.current.isHydrated).toBe(true);
        expect(result.current.settings.apiKey).toBe('hydrated-secret');
      });
    });

    it('updates settings with updateSettings', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ endpoint: 'https://new-endpoint.openai.azure.com' });
      });

      expect(result.current.settings.endpoint).toBe('https://new-endpoint.openai.azure.com');
    });

    it('persists settings through the encrypted storage helper when updated', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(storageMocks.persistStoredSettings).toHaveBeenCalledTimes(1);
      });

      storageMocks.persistStoredSettings.mockClear();

      act(() => {
        result.current.updateSettings({
          endpoint: 'https://persisted.openai.azure.com',
          apiKey: 'persisted-key',
        });
      });

      await waitFor(() => {
        expect(storageMocks.persistStoredSettings).toHaveBeenCalledWith({
          ...DEFAULT_SETTINGS,
          endpoint: 'https://persisted.openai.azure.com',
          apiKey: 'persisted-key',
        });
      });
    });

    it('resets settings to defaults with resetSettings', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ endpoint: 'https://custom.openai.azure.com' });
      });

      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('noLocalStorage functionality', () => {
    it('clears persisted encrypted settings when noLocalStorage is enabled', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(storageMocks.persistStoredSettings).toHaveBeenCalledTimes(1);
      });

      storageMocks.clearStoredSettings.mockClear();

      act(() => {
        result.current.updateSettings({ noLocalStorage: true });
      });

      await waitFor(() => {
        expect(storageMocks.clearStoredSettings).toHaveBeenCalledTimes(1);
      });
    });

    it('initializes with noLocalStorage: true and default values when stored noLocalStorage was true', () => {
      storageMocks.snapshot = {
        settings: {
          ...DEFAULT_SETTINGS,
          noLocalStorage: true,
        },
        hasEncryptedApiKey: false,
        isLegacyPlaintext: false,
      };

      const { result } = renderHook(() => useSettings());

      expect(result.current.settings.noLocalStorage).toBe(true);
      expect(result.current.settings.apiKey).toBe(DEFAULT_SETTINGS.apiKey);
      expect(result.current.settings.endpoint).toBe(DEFAULT_SETTINGS.endpoint);
    });

    it('resumes encrypted persistence when noLocalStorage is disabled', async () => {
      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(storageMocks.persistStoredSettings).toHaveBeenCalledTimes(1);
      });

      act(() => {
        result.current.updateSettings({ noLocalStorage: true });
      });

      await waitFor(() => {
        expect(storageMocks.clearStoredSettings).toHaveBeenCalledTimes(1);
      });

      storageMocks.persistStoredSettings.mockClear();

      act(() => {
        result.current.updateSettings({ noLocalStorage: false });
      });

      await waitFor(() => {
        expect(storageMocks.persistStoredSettings).toHaveBeenCalledWith({
          ...DEFAULT_SETTINGS,
          noLocalStorage: false,
        });
      });
    });
  });

  describe('isConfigured', () => {
    it('returns false when endpoint is empty', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.isConfigured).toBe(false);
    });

    it('returns false while encrypted settings are still hydrating', () => {
      storageMocks.snapshot = {
        settings: { ...DEFAULT_SETTINGS, endpoint: 'https://test.openai.azure.com', apiKey: '' },
        hasEncryptedApiKey: true,
        isLegacyPlaintext: false,
      };
      storageMocks.hydrateStoredApiKey.mockImplementation(
        async () =>
          new Promise<string>(resolve => {
            setTimeout(() => resolve('hydrated-key'), 10);
          })
      );

      const { result } = renderHook(() => useSettings());

      expect(result.current.isConfigured).toBe(false);
    });

    it('returns true when both endpoint and apiKey are set after hydration', async () => {
      storageMocks.snapshot = {
        settings: { ...DEFAULT_SETTINGS, endpoint: 'https://test.openai.azure.com', apiKey: '' },
        hasEncryptedApiKey: true,
        isLegacyPlaintext: false,
      };
      storageMocks.hydrateStoredApiKey.mockResolvedValue('test-api-key');

      const { result } = renderHook(() => useSettings());

      await waitFor(() => {
        expect(result.current.isConfigured).toBe(true);
      });
    });
  });

  describe('clearStoredData', () => {
    it('clears encrypted storage and resets to defaults', async () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({
          endpoint: 'https://test.openai.azure.com',
          apiKey: 'test-key',
        });
      });

      storageMocks.clearStoredSettings.mockClear();

      act(() => {
        result.current.clearStoredData();
      });

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);

      await waitFor(() => {
        expect(storageMocks.clearStoredSettings).toHaveBeenCalledTimes(1);
      });
    });
  });
});
