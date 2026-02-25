/**
 * LocalStorage utilities for persisting settings
 */

/** Storage key for application settings */
export const SETTINGS_STORAGE_KEY = 'azure-openai-settings';

/** Storage key for the last active thread ID */
export const ACTIVE_THREAD_STORAGE_KEY = 'active-thread-id';

/** All storage keys used by the application */
export const ALL_STORAGE_KEYS = [SETTINGS_STORAGE_KEY, ACTIVE_THREAD_STORAGE_KEY] as const;

/**
 * Retrieves a value from localStorage
 * @param key - Storage key
 * @param fallback - Default value if key doesn't exist or parsing fails
 * @returns Parsed value or fallback
 *
 * @example
 * const settings = getStoredValue('my-key', { name: 'default' });
 */
export function getStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      return fallback;
    }
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

/**
 * Stores a value in localStorage
 * @param key - Storage key
 * @param value - Value to store (will be JSON stringified)
 *
 * @example
 * setStoredValue('my-key', { name: 'value' });
 */
export function setStoredValue<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

/**
 * Removes a value from localStorage
 * @param key - Storage key to remove
 */
export function removeStoredValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
}

/**
 * Clears all application-related localStorage keys
 */
export function clearAllStoredValues(): void {
  try {
    for (const key of ALL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}
