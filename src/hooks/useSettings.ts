/**
 * Hook for managing application settings with localStorage persistence
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Settings, VectorStoreCache, VectorStore, VectorStoreFile } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  clearAllStoredValues,
  SETTINGS_STORAGE_KEY,
} from '../utils/localStorage';
import { createAzureClient } from '../utils/api';
import { listVectorStores } from '../utils/vectorStore';

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
  /** Vector store cache for persisting data across sidebar open/close */
  vectorStoreCache: VectorStoreCache;
  /** Update the cached vector stores list */
  setVectorStores: (stores: VectorStore[]) => void;
  /** Update cached files for a specific store */
  setStoreFiles: (storeId: string, files: VectorStoreFile[]) => void;
  /** Set loading state for a store's files */
  setStoreFilesLoading: (storeId: string, isLoading: boolean) => void;
  /** Clear the vector store cache */
  clearVectorStoreCache: () => void;
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
const EMPTY_CACHE: VectorStoreCache = {
  stores: [],
  storeFiles: {},
  storesFetchedAt: null,
  isStoresLoading: false,
  loadingStoreFiles: new Set(),
};

export function useSettings(): UseSettingsReturn {
  // Vector store cache (not persisted to localStorage, just in-memory)
  const [vectorStoreCache, setVectorStoreCache] = useState<VectorStoreCache>(EMPTY_CACHE);

  const setVectorStores = useCallback((stores: VectorStore[]) => {
    setVectorStoreCache(prev => ({
      ...prev,
      stores,
      storesFetchedAt: Date.now(),
      isStoresLoading: false,
    }));
  }, []);

  const setStoreFiles = useCallback((storeId: string, files: VectorStoreFile[]) => {
    setVectorStoreCache(prev => {
      const newLoadingStoreFiles = new Set(prev.loadingStoreFiles);
      newLoadingStoreFiles.delete(storeId);
      return {
        ...prev,
        storeFiles: {
          ...prev.storeFiles,
          [storeId]: files,
        },
        loadingStoreFiles: newLoadingStoreFiles,
      };
    });
  }, []);

  const setStoreFilesLoading = useCallback((storeId: string, isLoading: boolean) => {
    setVectorStoreCache(prev => {
      const newLoadingStoreFiles = new Set(prev.loadingStoreFiles);
      if (isLoading) {
        newLoadingStoreFiles.add(storeId);
      } else {
        newLoadingStoreFiles.delete(storeId);
      }
      return {
        ...prev,
        loadingStoreFiles: newLoadingStoreFiles,
      };
    });
  }, []);

  const clearVectorStoreCache = useCallback(() => {
    setVectorStoreCache(EMPTY_CACHE);
  }, []);

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
    setVectorStoreCache(EMPTY_CACHE);
  }, []);

  const clearStoredData = useCallback(() => {
    clearAllStoredValues();
    setSettings(DEFAULT_SETTINGS);
    setVectorStoreCache(EMPTY_CACHE);
  }, []);

  // Check if required fields are configured
  const isConfigured =
    settings.endpoint.trim() !== '' && settings.apiKey.trim() !== '';

  // Track the last endpoint/apiKey to detect credential changes  
  const lastCredentialsRef = useRef<{ endpoint: string; apiKey: string } | null>(null);

  // Pre-fetch vector stores in the background when credentials are available
  // Also clears cache when credentials change or become invalid
  useEffect(() => {
    const currentCredentials = { endpoint: settings.endpoint, apiKey: settings.apiKey };
    const credentialsChanged = 
      lastCredentialsRef.current === null ||
      lastCredentialsRef.current.endpoint !== currentCredentials.endpoint ||
      lastCredentialsRef.current.apiKey !== currentCredentials.apiKey;

    // Update the ref tracking
    lastCredentialsRef.current = currentCredentials;

    // Skip if no valid credentials (but clear cache asynchronously via IIFE first)
    if (!isConfigured) {
      // Clear stale cache when credentials become invalid
      if (credentialsChanged) {
        (async () => setVectorStoreCache(EMPTY_CACHE))();
      }
      return;
    }

    // Clear cache and re-fetch when credentials change
    if (credentialsChanged) {
      // Reset cache state before fetching
      (async () => {
        setVectorStoreCache(EMPTY_CACHE);
      })();
    } else if (vectorStoreCache.storesFetchedAt !== null) {
      // Skip if we've already fetched and credentials haven't changed
      return;
    }

    // Skip if already loading
    if (vectorStoreCache.isStoresLoading) {
      return;
    }

    // Capture values for the async closure
    const endpoint = settings.endpoint;
    const apiKey = settings.apiKey;

    // Use IIFE to avoid lint warning about sync setState in effect
    (async () => {
      setVectorStoreCache(prev => ({ ...prev, isStoresLoading: true }));

      try {
        const client = createAzureClient({ endpoint, apiKey });
        const stores = await listVectorStores(client);
        // Sort by creation date, newest first
        stores.sort((a, b) => b.createdAt - a.createdAt);
        setVectorStoreCache(prev => ({
          ...prev,
          stores,
          storesFetchedAt: Date.now(),
          isStoresLoading: false,
        }));
      } catch {
        // Silently fail - the component will retry when opened
        setVectorStoreCache(prev => ({ ...prev, isStoresLoading: false }));
      }
    })();
  }, [isConfigured, settings.endpoint, settings.apiKey, vectorStoreCache.storesFetchedAt, vectorStoreCache.isStoresLoading]);

  return {
    settings,
    updateSettings,
    resetSettings,
    clearStoredData,
    isConfigured,
    vectorStoreCache,
    setVectorStores,
    setStoreFiles,
    setStoreFilesLoading,
    clearVectorStoreCache,
  };
}
