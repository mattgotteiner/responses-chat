/**
 * Tests for useChat hook - retryMessage functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { DEFAULT_SETTINGS } from '../types';
import type { Settings } from '../types';

// vi.hoisted ensures these references are available inside the vi.mock factory
const { mockCreateAzureClient } = vi.hoisted(() => ({
  mockCreateAzureClient: vi.fn(),
}));

vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/api')>();
  return { ...actual, createAzureClient: mockCreateAzureClient };
});

// createRecordingSession returns null by default in non-RECORD environments,
// but mocking it makes the test deterministic regardless of env vars.
vi.mock('../utils/recording', () => ({
  createRecordingSession: vi.fn(() => null),
}));

const testSettings: Settings = {
  ...DEFAULT_SETTINGS,
  endpoint: 'https://test.openai.azure.com',
  apiKey: 'test-api-key',
};

/** Async generator that yields a single response.completed terminal event */
async function* completedStream(responseId = 'resp-mock-1') {
  yield {
    type: 'response.completed',
    response: { id: responseId, status: 'completed', output: [] },
  };
}

/** Async generator that throws immediately, simulating a network/API error */
async function* errorStream(): AsyncGenerator<never> {
  throw new Error('API request failed');
}

/** Build a minimal mock client whose create() returns a fresh stream each call */
function makeMockClient(streamFactory: () => AsyncGenerator) {
  return {
    responses: {
      create: vi.fn(async () => streamFactory()),
    },
  };
}

describe('useChat - retryMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper that drives the hook into a state with one user + one failed assistant
   * message by sending a message whose stream throws.
   */
  async function setupWithFailedMessage(content = 'Hello world') {
    mockCreateAzureClient.mockReturnValue(makeMockClient(errorStream));
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage(content, testSettings);
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].isError).toBe(true);
    return result;
  }

  describe('guard conditions', () => {
    it('does nothing when the message ID does not exist', async () => {
      const result = await setupWithFailedMessage();
      const messagesBefore = result.current.messages;

      await act(async () => {
        await result.current.retryMessage('nonexistent-id', testSettings);
      });

      expect(result.current.messages).toEqual(messagesBefore);
    });

    it('does nothing when the target message is not an error', async () => {
      mockCreateAzureClient.mockReturnValue(makeMockClient(completedStream));
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello', testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      const assistantMsg = result.current.messages.find((m) => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.isError).toBeFalsy();

      const messagesBefore = result.current.messages;

      await act(async () => {
        await result.current.retryMessage(assistantMsg!.id, testSettings);
      });

      expect(result.current.messages).toEqual(messagesBefore);
    });
  });

  describe('state mutation', () => {
    it('removes the failed assistant message and its preceding user message', async () => {
      const result = await setupWithFailedMessage();
      const failedId = result.current.messages[1].id;

      mockCreateAzureClient.mockReturnValue(makeMockClient(completedStream));

      await act(async () => {
        await result.current.retryMessage(failedId, testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      // 2 new messages from the retry (user + assistant), not the original 4
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].isError).toBeFalsy();
    });

    it('retries with the original user message content', async () => {
      const originalContent = 'This is the original question to retry';
      const result = await setupWithFailedMessage(originalContent);
      const failedId = result.current.messages[1].id;

      mockCreateAzureClient.mockReturnValue(makeMockClient(completedStream));

      await act(async () => {
        await result.current.retryMessage(failedId, testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      expect(result.current.messages[0].content).toBe(originalContent);
    });

    it('re-invokes the API (calls responses.create again)', async () => {
      const result = await setupWithFailedMessage();
      const failedId = result.current.messages[1].id;

      const retryClient = makeMockClient(completedStream);
      mockCreateAzureClient.mockReturnValue(retryClient);

      await act(async () => {
        await result.current.retryMessage(failedId, testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      expect(retryClient.responses.create).toHaveBeenCalledOnce();
    });
  });

  describe('previousResponseId restoration', () => {
    it('sends no previous_response_id when retrying the first-turn message', async () => {
      const result = await setupWithFailedMessage();
      const failedId = result.current.messages[1].id;

      const retryClient = makeMockClient(completedStream);
      mockCreateAzureClient.mockReturnValue(retryClient);

      await act(async () => {
        await result.current.retryMessage(failedId, testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      // First-turn message has no previous_response_id stored in requestJson
      expect(retryClient.responses.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ previous_response_id: expect.anything() }),
      );
    });

    it('restores previous_response_id from the user message requestJson when retrying a later-turn message', async () => {
      // 1. Send a successful first turn — sets previousResponseIdRef to 'resp-first-turn'
      mockCreateAzureClient.mockReturnValue(makeMockClient(() => completedStream('resp-first-turn')));
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('First message', testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      expect(result.current.messages).toHaveLength(2);

      // 2. Send a second message that fails
      mockCreateAzureClient.mockReturnValue(makeMockClient(errorStream));
      await act(async () => {
        await result.current.sendMessage('Second message', testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));
      expect(result.current.messages).toHaveLength(4);

      const failedId = result.current.messages[3].id;

      // Verify the user message's requestJson captured the correct previous_response_id
      const secondUserMsg = result.current.messages[2];
      expect(secondUserMsg.requestJson?.['previous_response_id']).toBe('resp-first-turn');

      // 3. Retry — should send with previous_response_id restored to 'resp-first-turn'
      const retryClient = makeMockClient(completedStream);
      mockCreateAzureClient.mockReturnValue(retryClient);

      await act(async () => {
        await result.current.retryMessage(failedId, testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      expect(retryClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({ previous_response_id: 'resp-first-turn' }),
      );
    });
  });
});
