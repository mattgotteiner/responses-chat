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

/**
 * Creates an OpenAI client configured for Azure OpenAI
 * Uses the standard OpenAI client with Azure endpoint as baseURL
 * @param settings - Application settings containing endpoint and API key
 * @returns Configured OpenAI client
 */
export function createAzureClient(settings: Settings): OpenAI {
  const baseURL = normalizeEndpoint(settings.endpoint);

  return new OpenAI({
    baseURL,
    apiKey: settings.apiKey,
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
