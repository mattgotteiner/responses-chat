/**
 * Vector store utilities for Azure OpenAI file search
 */

import OpenAI from 'openai';
import type { VectorStore, VectorStoreFile, VectorStoreStatus, VectorStoreFileStatus } from '../types';

/**
 * Converts API vector store status to our typed status
 */
function mapVectorStoreStatus(status: string): VectorStoreStatus {
  switch (status) {
    case 'expired':
      return 'expired';
    case 'in_progress':
      return 'in_progress';
    case 'completed':
    default:
      return 'completed';
  }
}

/**
 * Converts API file status to our typed status
 */
function mapFileStatus(status: string): VectorStoreFileStatus {
  switch (status) {
    case 'in_progress':
      return 'in_progress';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'completed':
    default:
      return 'completed';
  }
}

/**
 * Lists all vector stores
 * @param client - OpenAI client
 * @returns Array of vector stores
 */
export async function listVectorStores(client: OpenAI): Promise<VectorStore[]> {
  const response = await client.vectorStores.list({ limit: 100 });
  
  return response.data.map((store) => ({
    id: store.id,
    name: store.name || 'Unnamed Store',
    createdAt: store.created_at,
    expiresAt: store.expires_at ?? null,
    fileCount: store.file_counts?.completed ?? 0,
    status: mapVectorStoreStatus(store.status),
  }));
}

/**
 * Creates a new vector store with expiration policy
 * @param client - OpenAI client
 * @param name - Display name for the store
 * @param expirationMinutes - Number of minutes until expiration after last active use
 * @returns Created vector store
 */
export async function createVectorStore(
  client: OpenAI,
  name: string,
  expirationMinutes: number
): Promise<VectorStore> {
  // Convert minutes to days (API expects days)
  // Minimum is 1 day for the API, but we'll use the anchor approach
  // expires_after uses "last_active_at" anchor with days
  const expirationDays = Math.max(1, Math.ceil(expirationMinutes / 1440));
  
  const response = await client.vectorStores.create({
    name,
    expires_after: {
      anchor: 'last_active_at',
      days: expirationDays,
    },
  });

  return {
    id: response.id,
    name: response.name || name,
    createdAt: response.created_at,
    expiresAt: response.expires_at ?? null,
    fileCount: response.file_counts?.completed ?? 0,
    status: mapVectorStoreStatus(response.status),
  };
}

/**
 * Deletes a vector store
 * @param client - OpenAI client
 * @param storeId - ID of the vector store to delete
 */
export async function deleteVectorStore(client: OpenAI, storeId: string): Promise<void> {
  await client.vectorStores.delete(storeId);
}

/**
 * Gets all files in a vector store
 * @param client - OpenAI client
 * @param storeId - ID of the vector store
 * @returns Array of files in the store
 */
export async function getVectorStoreFiles(
  client: OpenAI,
  storeId: string
): Promise<VectorStoreFile[]> {
  const response = await client.vectorStores.files.list(storeId, { limit: 100 });
  
  // The vector store files list only returns file IDs and status
  // We need to fetch file details for each to get filename and size
  const files: VectorStoreFile[] = [];
  
  for (const vsFile of response.data) {
    try {
      const fileDetails = await client.files.retrieve(vsFile.id);
      files.push({
        id: vsFile.id,
        filename: fileDetails.filename,
        bytes: fileDetails.bytes,
        createdAt: fileDetails.created_at,
        status: mapFileStatus(vsFile.status),
      });
    } catch {
      // If we can't fetch file details, use placeholder data
      files.push({
        id: vsFile.id,
        filename: 'Unknown file',
        bytes: 0,
        createdAt: vsFile.created_at ?? 0,
        status: mapFileStatus(vsFile.status),
      });
    }
  }
  
  return files;
}

/**
 * Uploads a file and adds it to a vector store
 * @param client - OpenAI client
 * @param storeId - ID of the vector store
 * @param file - File to upload
 * @returns The uploaded file info
 */
export async function uploadFileToVectorStore(
  client: OpenAI,
  storeId: string,
  file: File
): Promise<VectorStoreFile> {
  // Use the SDK's uploadAndPoll helper which handles:
  // 1. Uploading the file to the Files API
  // 2. Attaching it to the vector store
  // 3. Polling until processing completes
  const vsFile = await client.vectorStores.files.uploadAndPoll(storeId, file);

  // Get file details for filename and size
  const fileDetails = await client.files.retrieve(vsFile.id);

  return {
    id: vsFile.id,
    filename: fileDetails.filename,
    bytes: fileDetails.bytes,
    createdAt: fileDetails.created_at,
    status: mapFileStatus(vsFile.status),
  };
}

/**
 * Removes a file from a vector store and deletes it
 * @param client - OpenAI client
 * @param storeId - ID of the vector store
 * @param fileId - ID of the file to remove
 */
export async function deleteFileFromVectorStore(
  client: OpenAI,
  storeId: string,
  fileId: string
): Promise<void> {
  // Remove from vector store first (SDK expects fileId, then params with vector_store_id)
  await client.vectorStores.files.delete(fileId, { vector_store_id: storeId });
  
  // Then delete the file itself
  try {
    await client.files.delete(fileId);
  } catch {
    // File may already be deleted or not found, ignore
  }
}

/**
 * Formats bytes as human-readable size
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Gets a human-readable expiration status
 * @param expiresAt - Unix timestamp of expiration, or null
 * @returns Status string
 */
export function getExpirationStatus(expiresAt: number | null): string {
  if (expiresAt === null) return 'No expiration';
  
  const now = Date.now() / 1000;
  const remaining = expiresAt - now;
  
  if (remaining <= 0) return 'Expired';
  
  if (remaining < 3600) {
    const minutes = Math.ceil(remaining / 60);
    return `Expires in ${minutes}m`;
  }
  
  if (remaining < 86400) {
    const hours = Math.ceil(remaining / 3600);
    return `Expires in ${hours}h`;
  }
  
  const days = Math.ceil(remaining / 86400);
  return `Expires in ${days}d`;
}
