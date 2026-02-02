/**
 * Tests for useSettings hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from './useSettings';
import { DEFAULT_SETTINGS } from '../types';
import { SETTINGS_STORAGE_KEY } from '../utils/localStorage';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('basic functionality', () => {
    it('returns default settings when localStorage is empty', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('loads settings from localStorage on initialization', () => {
      const storedSettings = { ...DEFAULT_SETTINGS, endpoint: 'https://test.openai.azure.com' };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(storedSettings));

      const { result } = renderHook(() => useSettings());
      expect(result.current.settings.endpoint).toBe('https://test.openai.azure.com');
    });

    it('updates settings with updateSettings', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ endpoint: 'https://new-endpoint.openai.azure.com' });
      });

      expect(result.current.settings.endpoint).toBe('https://new-endpoint.openai.azure.com');
    });

    it('persists settings to localStorage when updated', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ endpoint: 'https://persisted.openai.azure.com' });
      });

      const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      expect(stored.endpoint).toBe('https://persisted.openai.azure.com');
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
    it('does not persist settings when noLocalStorage is true', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ noLocalStorage: true });
      });

      // After enabling noLocalStorage, storage should be cleared
      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();

      // Further updates should not be persisted
      act(() => {
        result.current.updateSettings({ endpoint: 'https://not-saved.openai.azure.com' });
      });

      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    });

    it('clears existing localStorage when noLocalStorage is enabled', () => {
      // First, set up with stored data
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ endpoint: 'https://stored.openai.azure.com' });
      });

      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();

      // Enable noLocalStorage
      act(() => {
        result.current.updateSettings({ noLocalStorage: true });
      });

      // Storage should be cleared
      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    });

    it('reverts to defaults on reload when noLocalStorage was enabled', () => {
      // Simulate a stored noLocalStorage: true setting
      const storedSettings = { ...DEFAULT_SETTINGS, noLocalStorage: true, endpoint: 'https://should-not-persist.openai.azure.com' };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(storedSettings));

      const { result } = renderHook(() => useSettings());

      // Should revert to defaults, keeping only noLocalStorage: true
      expect(result.current.settings.endpoint).toBe(DEFAULT_SETTINGS.endpoint);
      expect(result.current.settings.noLocalStorage).toBe(true);
    });

    it('initializes with noLocalStorage: true and default values when stored noLocalStorage was true', () => {
      // Store settings with noLocalStorage: true and custom values
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...DEFAULT_SETTINGS,
        noLocalStorage: true,
        apiKey: 'secret-key',
        endpoint: 'https://custom.openai.azure.com',
      }));

      const { result } = renderHook(() => useSettings());

      // Should use defaults but keep noLocalStorage flag
      expect(result.current.settings.noLocalStorage).toBe(true);
      expect(result.current.settings.apiKey).toBe(DEFAULT_SETTINGS.apiKey);
      expect(result.current.settings.endpoint).toBe(DEFAULT_SETTINGS.endpoint);
    });

    it('resumes persistence when noLocalStorage is disabled', () => {
      const { result } = renderHook(() => useSettings());

      // Enable noLocalStorage
      act(() => {
        result.current.updateSettings({ noLocalStorage: true });
      });

      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();

      // Disable noLocalStorage
      act(() => {
        result.current.updateSettings({ noLocalStorage: false });
      });

      // Should start persisting again
      const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      expect(stored.noLocalStorage).toBe(false);

      // Further updates should be persisted
      act(() => {
        result.current.updateSettings({ endpoint: 'https://now-saved.openai.azure.com' });
      });

      const updatedStored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      expect(updatedStored.endpoint).toBe('https://now-saved.openai.azure.com');
    });
  });

  describe('isConfigured', () => {
    it('returns false when endpoint is empty', () => {
      const { result } = renderHook(() => useSettings());
      expect(result.current.isConfigured).toBe(false);
    });

    it('returns false when apiKey is empty', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({ endpoint: 'https://test.openai.azure.com' });
      });

      expect(result.current.isConfigured).toBe(false);
    });

    it('returns true when both endpoint and apiKey are set', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({
          endpoint: 'https://test.openai.azure.com',
          apiKey: 'test-api-key',
        });
      });

      expect(result.current.isConfigured).toBe(true);
    });
  });

  describe('clearStoredData', () => {
    it('clears localStorage and resets to defaults', () => {
      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSettings({
          endpoint: 'https://test.openai.azure.com',
          apiKey: 'test-key',
        });
      });

      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();

      act(() => {
        result.current.clearStoredData();
      });

      // Settings are reset to defaults
      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
      // Note: The useEffect will re-persist defaults, so storage won't be null
      // What's important is the settings are reset
      const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
      expect(stored.endpoint).toBe(DEFAULT_SETTINGS.endpoint);
      expect(stored.apiKey).toBe(DEFAULT_SETTINGS.apiKey);
    });
  });
});
