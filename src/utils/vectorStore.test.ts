/**
 * Tests for vector store utilities
 */

import { describe, it, expect } from 'vitest';
import { formatFileSize } from './vectorStore';

describe('vectorStore utilities', () => {
  describe('formatFileSize', () => {
    it('formats 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('formats gigabytes', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('clamps terabytes to gigabytes (max supported)', () => {
      // 1 TB = 1024 GB - should be clamped to GB unit
      expect(formatFileSize(1099511627776)).toBe('1024 GB');
      // 2 TB
      expect(formatFileSize(2199023255552)).toBe('2048 GB');
    });
  });
});
