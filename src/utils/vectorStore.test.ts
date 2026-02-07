/**
 * Tests for vector store utilities
 */

import { describe, it, expect } from 'vitest';
import { formatFileSize, getExpirationStatus } from './vectorStore';

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
  });

  describe('getExpirationStatus', () => {
    it('returns "No expiration" for null', () => {
      expect(getExpirationStatus(null)).toBe('No expiration');
    });

    it('returns "Expired" for past timestamps', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      expect(getExpirationStatus(pastTimestamp)).toBe('Expired');
    });

    it('returns minutes for less than 1 hour', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
      const result = getExpirationStatus(futureTimestamp);
      expect(result).toMatch(/Expires in \d+m/);
    });

    it('returns hours for less than 1 day', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
      const result = getExpirationStatus(futureTimestamp);
      expect(result).toMatch(/Expires in \d+h/);
    });

    it('returns days for 1 day or more', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 172800; // 2 days from now
      const result = getExpirationStatus(futureTimestamp);
      expect(result).toMatch(/Expires in \d+d/);
    });
  });
});
