/**
 * Tests for attachment utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  generateAttachmentId,
  isImageMimeType,
  isCodeInterpreterMimeType,
  isSupportedMimeType,
  getAttachmentType,
  isImageAttachment,
  getAcceptString,
  formatFileSize,
  getFileCategory,
  getFileTypeDescription,
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

  describe('isCodeInterpreterMimeType', () => {
    it('returns true for PDF', () => {
      expect(isCodeInterpreterMimeType('application/pdf')).toBe(true);
    });

    it('returns true for CSV', () => {
      expect(isCodeInterpreterMimeType('text/csv')).toBe(true);
    });

    it('returns true for JSON', () => {
      expect(isCodeInterpreterMimeType('application/json')).toBe(true);
    });

    it('returns true for text files', () => {
      expect(isCodeInterpreterMimeType('text/plain')).toBe(true);
      expect(isCodeInterpreterMimeType('text/markdown')).toBe(true);
    });

    it('returns true for code files', () => {
      expect(isCodeInterpreterMimeType('text/javascript')).toBe(true);
      expect(isCodeInterpreterMimeType('application/javascript')).toBe(true);
      expect(isCodeInterpreterMimeType('text/x-python')).toBe(true);
      expect(isCodeInterpreterMimeType('text/x-typescript')).toBe(true);
    });

    it('returns true for Excel files', () => {
      expect(isCodeInterpreterMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
      expect(isCodeInterpreterMimeType('application/vnd.ms-excel')).toBe(true);
    });

    it('returns true for Word files', () => {
      expect(isCodeInterpreterMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(isCodeInterpreterMimeType('application/msword')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isCodeInterpreterMimeType('video/mp4')).toBe(false);
      expect(isCodeInterpreterMimeType('audio/mpeg')).toBe(false);
    });
  });

  describe('isSupportedMimeType', () => {
    it('returns true for images', () => {
      expect(isSupportedMimeType('image/png')).toBe(true);
      expect(isSupportedMimeType('image/jpeg')).toBe(true);
    });

    it('returns true for PDF', () => {
      expect(isSupportedMimeType('application/pdf')).toBe(true);
    });

    it('returns true for code interpreter types', () => {
      expect(isSupportedMimeType('text/csv')).toBe(true);
      expect(isSupportedMimeType('application/json')).toBe(true);
      expect(isSupportedMimeType('text/x-python')).toBe(true);
    });

    it('returns false for unsupported types', () => {
      expect(isSupportedMimeType('video/mp4')).toBe(false);
      expect(isSupportedMimeType('audio/mpeg')).toBe(false);
    });
  });

  describe('getAttachmentType', () => {
    it('returns image for image mime types', () => {
      expect(getAttachmentType('image/png')).toBe('image');
      expect(getAttachmentType('image/jpeg')).toBe('image');
    });

    it('returns file for non-image types', () => {
      expect(getAttachmentType('application/pdf')).toBe('file');
      expect(getAttachmentType('text/csv')).toBe('file');
      expect(getAttachmentType('application/json')).toBe('file');
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
        size: 1000,
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
        size: 1000,
      };
      expect(isImageAttachment(attachment)).toBe(false);
    });
  });

  describe('getAcceptString', () => {
    it('includes image types', () => {
      const accept = getAcceptString();
      expect(accept).toContain('image/png');
      expect(accept).toContain('image/jpeg');
      expect(accept).toContain('image/webp');
    });

    it('includes PDF', () => {
      const accept = getAcceptString();
      expect(accept).toContain('application/pdf');
    });

    it('includes code interpreter types', () => {
      const accept = getAcceptString();
      expect(accept).toContain('text/csv');
      expect(accept).toContain('application/json');
    });

    it('includes file extensions for browser compatibility', () => {
      const accept = getAcceptString();
      expect(accept).toContain('.csv');
      expect(accept).toContain('.json');
      expect(accept).toContain('.xlsx');
      expect(accept).toContain('.py');
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

  describe('getFileCategory', () => {
    it('returns pdf for PDF files', () => {
      expect(getFileCategory('application/pdf')).toBe('pdf');
    });

    it('returns spreadsheet for CSV and Excel files', () => {
      expect(getFileCategory('text/csv')).toBe('spreadsheet');
      expect(getFileCategory('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('spreadsheet');
      expect(getFileCategory('application/vnd.ms-excel')).toBe('spreadsheet');
    });

    it('returns document for Word files', () => {
      expect(getFileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
      expect(getFileCategory('application/msword')).toBe('document');
    });

    it('returns code for programming language files', () => {
      expect(getFileCategory('text/javascript')).toBe('code');
      expect(getFileCategory('text/x-python')).toBe('code');
      expect(getFileCategory('text/x-typescript')).toBe('code');
    });

    it('returns data for JSON and XML files', () => {
      expect(getFileCategory('application/json')).toBe('data');
      expect(getFileCategory('text/xml')).toBe('data');
      expect(getFileCategory('application/xml')).toBe('data');
    });

    it('returns text for plain text and markdown', () => {
      expect(getFileCategory('text/plain')).toBe('text');
      expect(getFileCategory('text/markdown')).toBe('text');
    });

    it('returns generic for unknown types', () => {
      expect(getFileCategory('application/octet-stream')).toBe('generic');
      expect(getFileCategory('unknown/type')).toBe('generic');
    });
  });

  describe('getFileTypeDescription', () => {
    it('returns human-readable descriptions', () => {
      expect(getFileTypeDescription('application/pdf')).toBe('PDF');
      expect(getFileTypeDescription('text/csv')).toBe('CSV');
      expect(getFileTypeDescription('application/json')).toBe('JSON');
      expect(getFileTypeDescription('text/x-python')).toBe('Python');
      expect(getFileTypeDescription('text/x-typescript')).toBe('TypeScript');
    });

    it('returns "File" for unknown types', () => {
      expect(getFileTypeDescription('application/unknown')).toBe('File');
    });
  });

  // Note: readFileAsBase64 and createAttachmentFromFile are tested via integration
  // with real File/FileReader which requires browser environment or more complex mocking
});
