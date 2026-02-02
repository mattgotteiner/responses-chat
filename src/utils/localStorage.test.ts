import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStoredValue, setStoredValue, removeStoredValue, clearAllStoredValues, SETTINGS_STORAGE_KEY } from './localStorage';

describe('localStorage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getStoredValue', () => {
    it('returns fallback when key does not exist', () => {
      const result = getStoredValue('nonexistent', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('returns parsed value when key exists', () => {
      localStorage.setItem('test-key', JSON.stringify({ name: 'test' }));
      const result = getStoredValue('test-key', { name: 'default' });
      expect(result).toEqual({ name: 'test' });
    });

    it('returns fallback when stored value is invalid JSON', () => {
      localStorage.setItem('bad-json', 'not valid json');
      const result = getStoredValue('bad-json', 'fallback');
      expect(result).toBe('fallback');
    });

    it('handles primitive values', () => {
      localStorage.setItem('number', '42');
      expect(getStoredValue('number', 0)).toBe(42);

      localStorage.setItem('string', '"hello"');
      expect(getStoredValue('string', '')).toBe('hello');

      localStorage.setItem('bool', 'true');
      expect(getStoredValue('bool', false)).toBe(true);
    });
  });

  describe('setStoredValue', () => {
    it('stores objects as JSON', () => {
      setStoredValue('obj', { key: 'value' });
      expect(localStorage.getItem('obj')).toBe('{"key":"value"}');
    });

    it('stores primitive values', () => {
      setStoredValue('num', 123);
      expect(localStorage.getItem('num')).toBe('123');

      setStoredValue('str', 'test');
      expect(localStorage.getItem('str')).toBe('"test"');
    });

    it('handles storage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage full');
      });

      setStoredValue('key', 'value'); // Should not throw

      expect(consoleSpy).toHaveBeenCalled();
      mockSetItem.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('removeStoredValue', () => {
    it('removes existing key', () => {
      localStorage.setItem('to-remove', 'value');
      removeStoredValue('to-remove');
      expect(localStorage.getItem('to-remove')).toBeNull();
    });

    it('does not throw when key does not exist', () => {
      expect(() => removeStoredValue('nonexistent')).not.toThrow();
    });
  });

  describe('clearAllStoredValues', () => {
    it('clears all application storage keys', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ theme: 'dark' }));
      localStorage.setItem('other-key', 'should-remain');
      
      clearAllStoredValues();
      
      expect(localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
      // Other keys not in ALL_STORAGE_KEYS should remain
      expect(localStorage.getItem('other-key')).toBe('should-remain');
    });

    it('does not throw when keys do not exist', () => {
      expect(() => clearAllStoredValues()).not.toThrow();
    });

    it('handles storage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockRemoveItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      clearAllStoredValues(); // Should not throw

      expect(consoleSpy).toHaveBeenCalled();
      mockRemoveItem.mockRestore();
      consoleSpy.mockRestore();
    });
  });
});
