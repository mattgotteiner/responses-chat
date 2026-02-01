/**
 * Utility functions for handling file attachments
 */

import type { Attachment, AttachmentType } from '../types';
import { SUPPORTED_IMAGE_TYPES, SUPPORTED_FILE_TYPES } from '../types';

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
 * Check if a MIME type is a supported file type
 */
export function isFileMimeType(mimeType: string): boolean {
  return (SUPPORTED_FILE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Check if a MIME type is supported for attachments
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return isImageMimeType(mimeType) || isFileMimeType(mimeType);
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
  };
}

/**
 * Get the accept string for file input
 */
export function getAcceptString(): string {
  const imageTypes = SUPPORTED_IMAGE_TYPES.join(',');
  const fileTypes = SUPPORTED_FILE_TYPES.join(',');
  return `${imageTypes},${fileTypes}`;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
