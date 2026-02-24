/**
 * Vector store utilities for Azure OpenAI file search
 */

import OpenAI from 'openai';

/** Maximum supported file size for vector store uploads (1 GB) */
export const MAX_VECTOR_STORE_FILE_SIZE = 1024 * 1024 * 1024;
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
    fileCount: store.file_counts?.completed ?? 0,
    status: mapVectorStoreStatus(store.status),
  }));
}

/**
 * Creates a new vector store
 * @param client - OpenAI client
 * @param name - Display name for the store
 * @returns Created vector store
 */
export async function createVectorStore(
  client: OpenAI,
  name: string
): Promise<VectorStore> {
  const response = await client.vectorStores.create({ name });

  return {
    id: response.id,
    name: response.name || name,
    createdAt: response.created_at,
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
 * Fetches file details with a concurrency limit to avoid overwhelming the API
 * @param client - OpenAI client
 * @param vsFiles - Vector store file references
 * @param concurrencyLimit - Maximum concurrent requests (default: 5)
 * @returns Array of file details
 */
async function fetchFileDetailsWithConcurrency(
  client: OpenAI,
  vsFiles: Array<{ id: string; status: string; created_at?: number }>,
  concurrencyLimit = 5
): Promise<VectorStoreFile[]> {
  const results: VectorStoreFile[] = [];
  
  // Process files in batches to respect rate limits
  for (let i = 0; i < vsFiles.length; i += concurrencyLimit) {
    const batch = vsFiles.slice(i, i + concurrencyLimit);
    
    const batchResults = await Promise.all(
      batch.map(async (vsFile) => {
        try {
          const fileDetails = await client.files.retrieve(vsFile.id);
          return {
            id: vsFile.id,
            filename: fileDetails.filename,
            bytes: fileDetails.bytes,
            createdAt: fileDetails.created_at,
            status: mapFileStatus(vsFile.status),
          };
        } catch {
          // If we can't fetch file details, use placeholder data
          return {
            id: vsFile.id,
            filename: 'Unknown file',
            bytes: 0,
            createdAt: vsFile.created_at ?? 0,
            status: mapFileStatus(vsFile.status),
          };
        }
      })
    );
    
    results.push(...batchResults);
  }
  
  return results;
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
  // Use parallel fetching with concurrency limit to avoid long UI waits
  return fetchFileDetailsWithConcurrency(client, response.data);
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
 * @remarks Maximum supported size is 1 GB - larger values are clamped
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  // Clamp to GB max (index 3) since we only support files up to 1 GB
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}
