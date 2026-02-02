import { describe, it, expect } from 'vitest';
import {
  generateMessageId,
  generateReasoningId,
  generateToolCallId,
  createAzureClient,
} from './api';
import { DEFAULT_SETTINGS } from '../types';

describe('API utilities', () => {
  describe('generateMessageId', () => {
    it('generates unique IDs', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with msg_ prefix', () => {
      const id = generateMessageId();
      expect(id).toMatch(/^msg_/);
    });
  });

  describe('generateReasoningId', () => {
    it('generates unique IDs', () => {
      const id1 = generateReasoningId();
      const id2 = generateReasoningId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with reason_ prefix', () => {
      const id = generateReasoningId();
      expect(id).toMatch(/^reason_/);
    });
  });

  describe('generateToolCallId', () => {
    it('generates unique IDs', () => {
      const id1 = generateToolCallId();
      const id2 = generateToolCallId();
      expect(id1).not.toBe(id2);
    });

    it('generates IDs with tool_ prefix', () => {
      const id = generateToolCallId();
      expect(id).toMatch(/^tool_/);
    });
  });

  describe('createAzureClient', () => {
    const baseSettings = {
      ...DEFAULT_SETTINGS,
      endpoint: 'https://my-resource.openai.azure.com',
      apiKey: 'test-key',
    };

    it('creates a client with normalized endpoint', () => {
      const client = createAzureClient(baseSettings);
      expect(client).toBeDefined();
      expect(client.baseURL).toBe('https://my-resource.openai.azure.com/openai/v1');
    });

    it('handles endpoint with trailing slash', () => {
      const client = createAzureClient({
        ...baseSettings,
        endpoint: 'https://my-resource.openai.azure.com/',
      });
      expect(client.baseURL).toBe('https://my-resource.openai.azure.com/openai/v1');
    });

    it('does not double-append /openai/v1', () => {
      const client = createAzureClient({
        ...baseSettings,
        endpoint: 'https://my-resource.openai.azure.com/openai/v1',
      });
      expect(client.baseURL).toBe('https://my-resource.openai.azure.com/openai/v1');
    });
  });
});
