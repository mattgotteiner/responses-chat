/**
 * Hook for managing application settings with localStorage persistence
 */

import { useState, useCallback, useEffect } from 'react';
import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  clearAllStoredValues,
  SETTINGS_STORAGE_KEY,
} from '../utils/localStorage';

/** Return type for the useSettings hook */
export interface UseSettingsReturn {
  /** Current settings */
  settings: Settings;
  /** Update settings (partial update supported) */
  updateSettings: (updates: Partial<Settings>) => void;
  /** Reset settings to defaults */
  resetSettings: () => void;
  /** Clear all stored data and reset to defaults */
  clearStoredData: () => void;
  /** Whether required settings are configured */
  isConfigured: boolean;
}

/**
 * Hook for managing application settings with localStorage persistence
 *
 * @example
 * const { settings, updateSettings, isConfigured } = useSettings();
 *
 * // Update a single field
 * updateSettings({ apiKey: 'new-key' });
 *
 * // Check if ready to use
 * if (isConfigured) {
 *   // Can make API calls
 * }
 */
export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = getStoredValue(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS);
    // Merge with defaults to ensure new fields have default values
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // If noLocalStorage was enabled, don't use stored values (except noLocalStorage itself)
    if (merged.noLocalStorage) {
      return { ...DEFAULT_SETTINGS, noLocalStorage: true };
    }
    return merged;
  });

  // Sync to localStorage whenever settings change (unless noLocalStorage is enabled)
  useEffect(() => {
    if (settings.noLocalStorage) {
      // Clear any existing stored data when noLocalStorage is enabled
      removeStoredValue(SETTINGS_STORAGE_KEY);
    } else {
      setStoredValue(SETTINGS_STORAGE_KEY, settings);
    }
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const clearStoredData = useCallback(() => {
    clearAllStoredValues();
    setSettings(DEFAULT_SETTINGS);
  }, []);

  // Check if required fields are configured
  const isConfigured =
    settings.endpoint.trim() !== '' && settings.apiKey.trim() !== '';

  return {
    settings,
    updateSettings,
    resetSettings,
    clearStoredData,
    isConfigured,
  };
}
