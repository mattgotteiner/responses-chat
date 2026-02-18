/**
 * Azure OpenAI API utilities
 */

import OpenAI from 'openai';
import type { Settings, ReasoningEffort, ReasoningSummary } from '../types';

/**
 * Normalizes the endpoint URL to include /openai/v1 if not present
 * @param endpoint - The base Azure OpenAI endpoint
 * @returns Normalized endpoint URL
 */
function normalizeEndpoint(endpoint: string): string {
  let url = endpoint.trim();
  
  // Remove trailing slash
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  // Append /openai/v1 if not already present
  if (!url.endsWith('/openai/v1')) {
    url = `${url}/openai/v1`;
  }
  
  return url;
}

/** Credentials required for Azure OpenAI client */
export interface AzureCredentials {
  endpoint: string;
  apiKey: string;
}

/**
 * Creates an OpenAI client configured for Azure OpenAI
 * Uses the standard OpenAI client with Azure endpoint as baseURL
 * @param credentials - Object containing endpoint and API key (can be full Settings or just credentials)
 * @returns Configured OpenAI client
 */
export function createAzureClient(credentials: AzureCredentials): OpenAI {
  const baseURL = normalizeEndpoint(credentials.endpoint);

  return new OpenAI({
    baseURL,
    apiKey: credentials.apiKey,
    dangerouslyAllowBrowser: true, // Required for browser usage
  });
}

/** Parameters for creating a response */
export interface CreateResponseParams {
  /** User message content */
  input: string;
  /** Previous response ID for conversation continuity */
  previousResponseId?: string | null;
  /** Application settings */
  settings: Settings;
}

/** Reasoning configuration for the API */
export interface ReasoningConfig {
  effort?: ReasoningEffort;
  summary?: ReasoningSummary;
}

/**
 * Builds the reasoning configuration for the API request
 * @param settings - Application settings
 * @returns Reasoning configuration or undefined
 */
export function buildReasoningConfig(
  settings: Settings
): ReasoningConfig | undefined {
  if (!settings.reasoningEffort && !settings.reasoningSummary) {
    return undefined;
  }

  const config: ReasoningConfig = {};

  if (settings.reasoningEffort) {
    config.effort = settings.reasoningEffort;
  }

  if (settings.reasoningSummary) {
    config.summary = settings.reasoningSummary;
  }

  return config;
}

/**
 * Generates a unique message ID
 * @returns Unique string ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique reasoning step ID
 * @returns Unique string ID
 */
export function generateReasoningId(): string {
  return `reason_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a unique tool call ID
 * @returns Unique string ID
 */
export function generateToolCallId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Upload a file to Azure OpenAI Files API for use with code interpreter
 * Uses fetch with data URL to reliably convert base64 to binary blob
 * @param client - OpenAI client
 * @param file - Object with filename and base64 data
 * @returns Uploaded file ID
 */
export async function uploadFileForCodeInterpreter(
  client: OpenAI,
  file: { filename: string; base64: string; mimeType: string }
): Promise<string> {
  // Validate input
  if (!file.base64 || file.base64.length === 0) {
    throw new Error(`File ${file.filename}: base64 data is missing or empty`);
  }
  
  // Use fetch with data URL to reliably convert base64 to binary blob
  // This handles binary data more reliably than atob() which can have issues with certain characters
  const dataUrl = `data:${file.mimeType};base64,${file.base64}`;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  
  if (blob.size === 0) {
    throw new Error(`File ${file.filename}: decoded blob is empty`);
  }
  
  const fileObj = new File([blob], file.filename, { type: file.mimeType });
  
  // Upload to Files API with purpose 'assistants' (required for code interpreter)
  // Note: expires_after is not supported by Azure OpenAI Files API
  const uploadedFile = await client.files.create({
    file: fileObj,
    purpose: 'assistants',
  });
  
  return uploadedFile.id;
}

/**
 * Download a file from a code interpreter container
 * @param credentials - Azure OpenAI credentials
 * @param containerId - Container ID where the file was generated
 * @param fileId - File ID within the container
 * @returns Blob of the file content
 */
export async function downloadContainerFile(
  credentials: AzureCredentials,
  containerId: string,
  fileId: string
): Promise<Blob> {
  const baseURL = normalizeEndpoint(credentials.endpoint);
  const url = `${baseURL}/containers/${containerId}/files/${fileId}/content`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'api-key': credentials.apiKey,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  
  return response.blob();
}

/**
 * Create a download URL for a container file
 * Downloads the file content and creates a blob URL for download
 * @param credentials - Azure OpenAI credentials
 * @param containerId - Container ID where the file was generated
 * @param fileId - File ID within the container
 * @param filename - Filename for the download
 * @returns Promise that resolves when download is triggered
 */
export async function triggerContainerFileDownload(
  credentials: AzureCredentials,
  containerId: string,
  fileId: string,
  filename: string
): Promise<void> {
  const blob = await downloadContainerFile(credentials, containerId, fileId);
  
  // Create a blob URL and trigger download
  const blobUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Clean up the blob URL after a delay to allow the download to start
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
