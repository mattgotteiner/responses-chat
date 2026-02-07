/**
 * Utility functions for handling file attachments
 */

import type { Attachment, AttachmentType } from '../types';
import { SUPPORTED_IMAGE_TYPES, SUPPORTED_CODE_INTERPRETER_TYPES } from '../types';

/**
 * Generate a unique attachment ID
 */
export function generateAttachmentId(): string {
  return `attach_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Check if a MIME type is a supported image type
 */
export function isImageMimeType(mimeType: string): boolean {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a MIME type is supported for code interpreter (and general file attachments)
 */
export function isCodeInterpreterMimeType(mimeType: string): boolean {
  return (SUPPORTED_CODE_INTERPRETER_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a MIME type is supported for attachments
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return isImageMimeType(mimeType) || isCodeInterpreterMimeType(mimeType);
}

/**
 * Get the attachment type based on MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
  return isImageMimeType(mimeType) ? 'image' : 'file';
}

/**
 * Check if an attachment is an image
 */
export function isImageAttachment(attachment: Attachment): boolean {
  return attachment.type === 'image';
}

/**
 * File category for icon display
 */
export type FileCategory = 'pdf' | 'spreadsheet' | 'document' | 'code' | 'data' | 'text' | 'generic';

/**
 * Get the file category for icon display based on MIME type
 */
export function getFileCategory(mimeType: string): FileCategory {
  // PDF
  if (mimeType === 'application/pdf') return 'pdf';
  
  // Spreadsheets
  if (mimeType === 'text/csv' ||
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel') return 'spreadsheet';
  
  // Documents
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword') return 'document';
  
  // Code files
  if (mimeType === 'text/javascript' ||
      mimeType === 'application/javascript' ||
      mimeType === 'text/x-python' ||
      mimeType === 'application/x-python-code' ||
      mimeType === 'text/x-typescript') return 'code';
  
  // Data formats
  if (mimeType === 'application/json' ||
      mimeType === 'text/xml' ||
      mimeType === 'application/xml') return 'data';
  
  // Text/Markdown
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') return 'text';
  
  return 'generic';
}

/**
 * Get user-friendly file type description
 */
export function getFileTypeDescription(mimeType: string): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/csv': 'CSV',
    'application/json': 'JSON',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
    'text/xml': 'XML',
    'application/xml': 'XML',
    'text/javascript': 'JavaScript',
    'application/javascript': 'JavaScript',
    'text/x-python': 'Python',
    'application/x-python-code': 'Python',
    'text/x-typescript': 'TypeScript',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/msword': 'Word',
  };
  return typeMap[mimeType] || 'File';
}

/**
 * Result from reading a file as base64
 */
export interface FileReadResult {
  /** Base64-encoded content (without data URL prefix) */
  base64: string;
  /** MIME type of the file */
  mimeType: string;
  /** Data URL for preview (full data:mime;base64,... format) */
  dataUrl: string;
}

/**
 * Read a file as base64-encoded data
 * @param file - The File object to read
 * @returns Promise resolving to FileReadResult
 */
export function readFileAsBase64(file: File): Promise<FileReadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract base64 portion after the comma
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Failed to extract base64 data'));
        return;
      }
      resolve({
        base64,
        mimeType: file.type,
        dataUrl,
      });
    };
    
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Create an Attachment object from a File
 * @param file - The File object to convert
 * @returns Promise resolving to Attachment
 */
export async function createAttachmentFromFile(file: File): Promise<Attachment> {
  const { base64, mimeType, dataUrl } = await readFileAsBase64(file);
  const type = getAttachmentType(mimeType);
  
  return {
    id: generateAttachmentId(),
    name: file.name,
    type,
    mimeType,
    base64,
    // Only include preview URL for images
    previewUrl: type === 'image' ? dataUrl : undefined,
    size: file.size,
  };
}

/**
 * Get the accept string for file input
 */
export function getAcceptString(): string {
  const imageTypes = SUPPORTED_IMAGE_TYPES.join(',');
  const codeInterpreterTypes = SUPPORTED_CODE_INTERPRETER_TYPES.join(',');
  // Also add common file extensions for better browser compatibility
  const extensions = '.pdf,.csv,.json,.txt,.md,.xml,.js,.ts,.py,.xlsx,.xls,.docx,.doc';
  return `${imageTypes},${codeInterpreterTypes},${extensions}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
