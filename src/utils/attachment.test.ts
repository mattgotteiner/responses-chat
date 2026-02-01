/**
 * Tests for attachment utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateAttachmentId,
  isImageMimeType,
  isFileMimeType,
  isSupportedMimeType,
  getAttachmentType,
  isImageAttachment,
  getAcceptString,
  formatFileSize,
} from './attachment';
import type { Attachment } from '../types';

describe('attachment utilities', () => {
  describe('generateAttachmentId', () => {
    it('generates unique IDs', () => {
      const id1 = generateAttachmentId();
      const id2 = generateAttachmentId();
      expect(id1).not.toBe(id2);
    });

    it('starts with attach_ prefix', () => {
      const id = generateAttachmentId();
      expect(id).toMatch(/^attach_/);
    });
  });

  describe('isImageMimeType', () => {
    it('returns true for supported image types', () => {
      expect(isImageMimeType('image/png')).toBe(true);
      expect(isImageMimeType('image/jpeg')).toBe(true);
      expect(isImageMimeType('image/webp')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isImageMimeType('image/gif')).toBe(false);
      expect(isImageMimeType('application/pdf')).toBe(false);
      expect(isImageMimeType('text/plain')).toBe(false);
    });
  });

  describe('isFileMimeType', () => {
    it('returns true for supported file types', () => {
      expect(isFileMimeType('application/pdf')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isFileMimeType('image/png')).toBe(false);
      expect(isFileMimeType('text/plain')).toBe(false);
    });
  });

  describe('isSupportedMimeType', () => {
    it('returns true for images and files', () => {
      expect(isSupportedMimeType('image/png')).toBe(true);
      expect(isSupportedMimeType('application/pdf')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isSupportedMimeType('text/plain')).toBe(false);
      expect(isSupportedMimeType('video/mp4')).toBe(false);
    });
  });

  describe('getAttachmentType', () => {
    it('returns image for image mime types', () => {
      expect(getAttachmentType('image/png')).toBe('image');
      expect(getAttachmentType('image/jpeg')).toBe('image');
    });

    it('returns file for non-image types', () => {
      expect(getAttachmentType('application/pdf')).toBe('file');
    });
  });

  describe('isImageAttachment', () => {
    it('returns true for image attachments', () => {
      const attachment: Attachment = {
        id: 'test',
        name: 'test.png',
        type: 'image',
        mimeType: 'image/png',
        base64: 'abc123',
      };
      expect(isImageAttachment(attachment)).toBe(true);
    });

    it('returns false for file attachments', () => {
      const attachment: Attachment = {
        id: 'test',
        name: 'test.pdf',
        type: 'file',
        mimeType: 'application/pdf',
        base64: 'abc123',
      };
      expect(isImageAttachment(attachment)).toBe(false);
    });
  });

  describe('getAcceptString', () => {
    it('includes image and file types', () => {
      const accept = getAcceptString();
      expect(accept).toContain('image/png');
      expect(accept).toContain('image/jpeg');
      expect(accept).toContain('image/webp');
      expect(accept).toContain('application/pdf');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('formats kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(2048)).toBe('2.0 KB');
    });

    it('formats megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  // Note: readFileAsBase64 and createAttachmentFromFile are tested via integration
  // with real File/FileReader which requires browser environment or more complex mocking
});
