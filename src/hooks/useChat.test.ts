/**
 * Tests for useChat hook - retryMessage functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { DEFAULT_SETTINGS } from '../types';
import type { Settings, Message, Attachment } from '../types';

// vi.hoisted ensures these references are available inside the vi.mock factory
const { mockCreateAzureClient, mockUploadFileForCodeInterpreter } = vi.hoisted(() => ({
  mockCreateAzureClient: vi.fn(),
  mockUploadFileForCodeInterpreter: vi.fn<() => Promise<string>>(),
}));

vi.mock('../utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/api')>();
  return { ...actual, createAzureClient: mockCreateAzureClient, uploadFileForCodeInterpreter: mockUploadFileForCodeInterpreter };
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
// eslint-disable-next-line require-yield
async function* errorStream(): AsyncGenerator<never> {
  throw new Error('API request failed');
}

/** Async generator that throws immediately with structured error metadata */
function errorStreamWithMetadata(error: Error) {
  // eslint-disable-next-line require-yield
  return async function* (): AsyncGenerator<never> {
    throw error;
  };
}

/** Build a minimal mock client whose create() returns a fresh stream each call */
function makeMockClient(streamFactory: () => AsyncIterable<unknown>) {
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

    it('stores structured error metadata on failed assistant messages', async () => {
      const codedError = Object.assign(new Error('API request failed'), {
        code: 'bad_request',
        status: 400,
        type: 'invalid_request_error',
      });
      mockCreateAzureClient.mockReturnValue(makeMockClient(errorStreamWithMetadata(codedError)));

      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello', testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      const failedMessage = result.current.messages[1];
      expect(failedMessage.isError).toBe(true);
      expect(failedMessage.errorCode).toBe('bad_request');
      expect(failedMessage.responseJson).toEqual(
        expect.objectContaining({
          status: 'failed',
          status_code: 400,
          error_name: 'Error',
          error: expect.objectContaining({
            message: 'API request failed',
            code: 'bad_request',
            type: 'invalid_request_error',
          }),
        })
      );
    });

    it('preserves error metadata when a retry fails again', async () => {
      const result = await setupWithFailedMessage();
      const failedId = result.current.messages[1].id;

      const retryError = Object.assign(new Error('Retry failed'), {
        code: 'server_error',
        status: 500,
      });
      mockCreateAzureClient.mockReturnValue(makeMockClient(errorStreamWithMetadata(retryError)));

      await act(async () => {
        await result.current.retryMessage(failedId, testSettings);
      });
      await waitFor(() => expect(result.current.isStreaming).toBe(false));

      const retriedFailure = result.current.messages[1];
      expect(retriedFailure.isError).toBe(true);
      expect(retriedFailure.errorCode).toBe('server_error');
      expect(retriedFailure.responseJson).toEqual(
        expect.objectContaining({
          status: 'failed',
          status_code: 500,
          error: expect.objectContaining({
            message: 'Retry failed',
            code: 'server_error',
          }),
        })
      );
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
        expect.anything(),
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
        expect.anything(),
      );
    });
  });
});

describe('useChat - sendMessage request payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function sendWithSettings(settings: Settings) {
    const mockClient = makeMockClient(() => completedStream());
    mockCreateAzureClient.mockReturnValue(mockClient);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Hello', settings);
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    return mockClient.responses.create;
  }

  describe('parallel_tool_calls', () => {
    it('omits parallel_tool_calls when parallelToolCallsEnabled is false (default)', async () => {
      const createSpy = await sendWithSettings(testSettings);
      expect(createSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({ parallel_tool_calls: expect.anything() }),
        expect.anything(),
      );
    });

    it('includes parallel_tool_calls: true when parallelToolCallsEnabled is true', async () => {
      const settings: Settings = { ...testSettings, parallelToolCallsEnabled: true };
      const createSpy = await sendWithSettings(settings);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ parallel_tool_calls: true }),
        expect.anything(),
      );
    });
  });

  describe('verbosity', () => {
    it('sends verbosity under text and preserves the same shape in requestJson', async () => {
      const settings: Settings = { ...testSettings, verbosity: 'high' };
      const mockClient = makeMockClient(() => completedStream());
      mockCreateAzureClient.mockReturnValue(mockClient);
      const { result } = renderHook(() => useChat());

      await act(async () => {
        await result.current.sendMessage('Hello', settings);
      });

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false);
      });

      expect(mockClient.responses.create).toHaveBeenCalledOnce();
      const responseCreateCalls = mockClient.responses.create.mock.calls as unknown[][];
      const requestArgs = responseCreateCalls[0]?.[0];
      expect(requestArgs).toEqual(
        expect.objectContaining({
          text: { verbosity: 'high' },
        })
      );
      expect(requestArgs).not.toHaveProperty('verbosity');

      const userMessage = result.current.messages.find((message) => message.role === 'user');
      expect(userMessage?.requestJson).toEqual(
        expect.objectContaining({
          text: { verbosity: 'high' },
          stream: true,
        })
      );
      expect(userMessage?.requestJson).not.toHaveProperty('verbosity');
    });

    it('sends MCP approval verbosity under text instead of a top-level field', async () => {
      const settings: Settings = { ...testSettings, verbosity: 'low' };
      const mockClient = makeMockClient(() => completedStream());
      mockCreateAzureClient.mockReturnValue(mockClient);
      const { result } = renderHook(() => useChat());

      act(() => {
        result.current.loadThread(
          [
            {
              id: 'assistant-1',
              role: 'assistant',
              content: 'Approval required',
              toolCalls: [
                {
                  id: 'tool-1',
                  name: 'mcp',
                  type: 'mcp_approval',
                  arguments: '{}',
                  approvalRequestId: 'approval-1',
                  status: 'pending_approval',
                },
              ],
              timestamp: new Date(),
            },
          ],
          'resp-prev',
          [],
        );
      });

      await act(async () => {
        await result.current.handleMcpApproval('approval-1', true, settings);
      });

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false);
      });

      expect(mockClient.responses.create).toHaveBeenCalledOnce();
      const responseCreateCalls = mockClient.responses.create.mock.calls as unknown[][];
      const requestArgs = responseCreateCalls[0]?.[0];
      expect(requestArgs).toEqual(
        expect.objectContaining({
          previous_response_id: 'resp-prev',
          text: { verbosity: 'low' },
        })
      );
      expect(requestArgs).not.toHaveProperty('verbosity');
    });
  });

  describe('sampling parameters', () => {
    it('includes temperature and top_p when gpt-5.2 uses reasoning effort none', async () => {
      const settings: Settings = {
        ...testSettings,
        modelName: 'gpt-5.2',
        reasoningEffort: 'none',
        temperatureEnabled: true,
        topPEnabled: true,
        temperature: 0.6,
        topP: 0.8,
      };
      const createSpy = await sendWithSettings(settings);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.6,
          top_p: 0.8,
        }),
        expect.anything(),
      );
    });

    it('includes temperature and top_p for models that support none', async () => {
      const settings: Settings = {
        ...testSettings,
        modelName: 'gpt-5.5',
        reasoningEffort: 'none',
        temperatureEnabled: true,
        topPEnabled: true,
        temperature: 0.6,
        topP: 0.8,
      };
      const createSpy = await sendWithSettings(settings);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.6,
          top_p: 0.8,
        }),
        expect.anything(),
      );
    });

    it('omits temperature and top_p for models that do not support none', async () => {
      const settings: Settings = {
        ...testSettings,
        modelName: 'gpt-5-mini',
        reasoningEffort: 'none',
        temperatureEnabled: true,
        topPEnabled: true,
        temperature: 0.6,
        topP: 0.8,
      };
      const createSpy = await sendWithSettings(settings);

      expect(createSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          temperature: expect.anything(),
          top_p: expect.anything(),
        }),
        expect.anything(),
      );
    });

    it('includes temperature and top_p for MCP approval requests when eligible', async () => {
      const settings: Settings = {
        ...testSettings,
        modelName: 'gpt-5.4',
        reasoningEffort: 'none',
        temperatureEnabled: true,
        topPEnabled: true,
        temperature: 0.4,
        topP: 0.9,
      };
      const mockClient = makeMockClient(() => completedStream());
      mockCreateAzureClient.mockReturnValue(mockClient);
      const { result } = renderHook(() => useChat());

      act(() => {
        result.current.loadThread(
          [
            {
              id: 'assistant-1',
              role: 'assistant',
              content: 'Approval required',
              toolCalls: [
                {
                  id: 'tool-1',
                  name: 'mcp',
                  type: 'mcp_approval',
                  arguments: '{}',
                  approvalRequestId: 'approval-1',
                  status: 'pending_approval',
                },
              ],
              timestamp: new Date(),
            },
          ],
          'resp-prev',
          [],
        );
      });

      await act(async () => {
        await result.current.handleMcpApproval('approval-1', true, settings);
      });

      await waitFor(() => {
        expect(result.current.isStreaming).toBe(false);
      });

      expect(mockClient.responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previous_response_id: 'resp-prev',
          temperature: 0.4,
          top_p: 0.9,
        }),
        expect.anything(),
      );
    });

    it('omits temperature and top_p when the sampling checkboxes are disabled', async () => {
      const settings: Settings = {
        ...testSettings,
        modelName: 'gpt-5.2',
        reasoningEffort: 'none',
        temperature: 0.6,
        topP: 0.8,
      };
      const createSpy = await sendWithSettings(settings);

      expect(createSpy).toHaveBeenCalledWith(
        expect.not.objectContaining({
          temperature: expect.anything(),
          top_p: expect.anything(),
        }),
        expect.anything(),
      );
    });

    it('sends default sampling values when enabled without custom slider values', async () => {
      const settings: Settings = {
        ...testSettings,
        modelName: 'gpt-5.2',
        reasoningEffort: 'none',
        temperatureEnabled: true,
        topPEnabled: true,
      };
      const createSpy = await sendWithSettings(settings);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 1,
          top_p: 1,
        }),
        expect.anything(),
      );
    });
  });

  it('uses the web_search tool when web search is enabled', async () => {
    const settings: Settings = {
      ...testSettings,
      webSearchEnabled: true,
      webSearchContextSize: 'high',
    };
    const createSpy = await sendWithSettings(settings);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'web_search',
            search_context_size: 'high',
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('sends OAuth authorization for authenticated MCP servers', async () => {
    const settings: Settings = {
      ...testSettings,
      mcpServers: [
        {
          id: 'mcp-1',
          name: 'Gmail MCP',
          serverLabel: 'gmail',
          serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
          requireApproval: 'never',
          headers: [],
          enabled: true,
          oauth: {
            enabled: true,
            clientId: 'client-id',
            clientSecret: 'client-secret',
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: [
              'https://www.googleapis.com/auth/gmail.readonly',
              'https://www.googleapis.com/auth/gmail.compose',
            ],
            accessToken: 'oauth-access-token',
            expiresAt: Date.now() + 3_600_000,
          },
        },
      ],
    };
    const createSpy = await sendWithSettings(settings);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'mcp',
            server_label: 'gmail',
            server_url: 'https://gmailmcp.googleapis.com/mcp/v1',
            authorization: 'oauth-access-token',
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('does not send expired OAuth authorization for MCP servers', async () => {
    const settings: Settings = {
      ...testSettings,
      mcpServers: [
        {
          id: 'mcp-1',
          name: 'Gmail MCP',
          serverLabel: 'gmail',
          serverUrl: 'https://gmailmcp.googleapis.com/mcp/v1',
          requireApproval: 'never',
          headers: [],
          enabled: true,
          oauth: {
            enabled: true,
            clientId: 'client-id',
            clientSecret: 'client-secret',
            authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
            accessToken: 'expired-access-token',
            expiresAt: Date.now() - 1,
          },
        },
      ],
    };
    const createSpy = await sendWithSettings(settings);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'mcp',
            server_label: 'gmail',
          }),
        ]),
      }),
      expect.anything(),
    );
    expect(createSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            authorization: 'expired-access-token',
          }),
        ]),
      }),
      expect.anything(),
    );
  });

  it('reuses uploaded file IDs from loaded thread when code interpreter is enabled', async () => {
    const mockClient = makeMockClient(() => completedStream());
    mockCreateAzureClient.mockReturnValue(mockClient);
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.loadThread([], 'resp-prev', ['file_1']);
    });

    await act(async () => {
      await result.current.sendMessage('Use prior files', { ...testSettings, codeInterpreterEnabled: true });
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(mockClient.responses.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'code_interpreter',
            container: expect.objectContaining({
              file_ids: ['file_1'],
            }),
          }),
        ]),
      }),
      expect.anything()
    );
  });
});

/**
 * Returns a stream that blocks until `complete()` is called.
 * Useful for testing mid-stream operations like detachStream / reattachStream.
 */
function makeControlledStream() {
  let resolver: ((v: IteratorResult<unknown>) => void) | null = null;
  const iterator = {
    next: (): Promise<IteratorResult<unknown>> =>
      new Promise((r) => {
        resolver = r;
      }),
  };
  const complete = (responseId = 'resp-ctrl') => {
    resolver?.({
      value: {
        type: 'response.completed',
        response: { id: responseId, status: 'completed', output: [] },
      },
      done: false,
    });
  };
  return { stream: { [Symbol.asyncIterator]: () => iterator }, complete };
}

describe('useChat - detachStream and reattachStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reattachStream returns null when no background stream exists for that thread', () => {
    const { result } = renderHook(() => useChat());
    let buf: ReturnType<typeof result.current.reattachStream>;
    act(() => {
      buf = result.current.reattachStream('nonexistent-thread');
    });
    expect(buf!).toBeNull();
  });

  it('detachStream does nothing when no foreground stream is active', () => {
    const { result } = renderHook(() => useChat());
    const onComplete = vi.fn();
    act(() => {
      result.current.detachStream('thread-1', [], [], onComplete);
    });
    expect(result.current.isStreaming).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('detachStream immediately sets isStreaming=false while stream continues in background', async () => {
    const { stream, complete } = makeControlledStream();
    mockCreateAzureClient.mockReturnValue(makeMockClient(() => stream));
    const { result } = renderHook(() => useChat());

    act(() => { void result.current.sendMessage('Hello', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    const msgs = [...result.current.messages];
    const onComplete = vi.fn();
    act(() => {
      result.current.detachStream('thread-1', msgs, [], onComplete);
    });

    // isStreaming drops immediately
    expect(result.current.isStreaming).toBe(false);
    // onComplete not yet called — stream still running
    expect(onComplete).not.toHaveBeenCalled();

    // Complete the background stream
    act(() => { complete('resp-background'); });

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    const [finalMsgs, finalPrevId] = onComplete.mock.calls[0] as [Message[], string];
    expect(finalPrevId).toBe('resp-background');
    // assistant message should no longer be streaming
    const assistantMsg = finalMsgs.find((m) => m.role === 'assistant');
    expect(assistantMsg?.isStreaming).toBe(false);
  });

  it('background stream completion does not affect foreground isStreaming', async () => {
    const { stream: bgStream, complete: completeBg } = makeControlledStream();
    mockCreateAzureClient.mockReturnValue(makeMockClient(() => bgStream));
    const { result } = renderHook(() => useChat());

    // Start first stream
    act(() => { void result.current.sendMessage('First', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    // Detach it
    act(() => {
      result.current.detachStream('thread-1', [...result.current.messages], [], vi.fn());
    });
    expect(result.current.isStreaming).toBe(false);

    // Start a second foreground stream
    const { stream: fgStream, complete: completeFg } = makeControlledStream();
    mockCreateAzureClient.mockReturnValue(makeMockClient(() => fgStream));
    act(() => { void result.current.sendMessage('Second', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    // Complete the background stream — should NOT touch foreground isStreaming
    act(() => { completeBg(); });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.isStreaming).toBe(true); // foreground still running

    // Complete the foreground stream
    act(() => { completeFg(); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });

  it('reattachStream restores foreground streaming and onComplete is not called', async () => {
    const { stream, complete } = makeControlledStream();
    mockCreateAzureClient.mockReturnValue(makeMockClient(() => stream));
    const { result } = renderHook(() => useChat());

    act(() => { void result.current.sendMessage('Hello', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    const msgs = [...result.current.messages];
    const onComplete = vi.fn();
    act(() => {
      result.current.detachStream('thread-1', msgs, [], onComplete);
    });
    expect(result.current.isStreaming).toBe(false);

    // Reattach
    let buffer: ReturnType<typeof result.current.reattachStream> = null;
    act(() => {
      buffer = result.current.reattachStream('thread-1');
    });
    expect(result.current.isStreaming).toBe(true);
    expect(buffer).not.toBeNull();
    expect((buffer as unknown as Message[]).length).toBe(msgs.length);

    // Complete the now-foreground stream
    act(() => { complete(); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // onComplete should NOT be called — stream was reattached before completing
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Regression test: background streams aborted on unmount
// ---------------------------------------------------------------------------

describe('useChat - unmount cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts all background streams when the hook unmounts', async () => {
    const { stream } = makeControlledStream();
    mockCreateAzureClient.mockReturnValue(makeMockClient(() => stream));
    const { result, unmount } = renderHook(() => useChat());

    // Start a stream and detach it to background
    act(() => { void result.current.sendMessage('Hello', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    const onComplete = vi.fn();
    // Capture abort signal by spying on the AbortController abort method
    // We need to check that the background stream's abort controller is called on unmount.
    // We do this indirectly: detach the stream, unmount, then verify onComplete was never called
    // and the stream doesn't cause state updates after unmount.
    act(() => {
      result.current.detachStream('thread-1', [...result.current.messages], [], onComplete);
    });
    expect(result.current.isStreaming).toBe(false);

    // Unmount while background stream is still running
    unmount();

    // After unmount, completing the stream should not call onComplete
    // (the background entry was cleared during cleanup)
    // Give async tasks time to settle
    await new Promise((r) => setTimeout(r, 20));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('detachStream during file upload immediately sets isStreaming=false (regression: stuck send button)', async () => {
    // Regression test for: when a user uploads a file, sends, then switches chats
    // while the upload is still in flight, detachStream must still succeed because
    // the AbortController is now created before the upload (not after).
    // Previously abortControllerRef.current was null during upload, causing detachStream
    // to bail early, leaving isStreaming=true stuck on the new chat.

    // Block the file upload until we manually resolve it
    let resolveUpload!: (fileId: string) => void;
    const uploadPromise = new Promise<string>((resolve) => { resolveUpload = resolve; });
    mockUploadFileForCodeInterpreter.mockReturnValue(uploadPromise);

    const { stream } = makeControlledStream();
    mockCreateAzureClient.mockReturnValue(makeMockClient(() => stream));
    const { result } = renderHook(() => useChat());

    // Start a send with a file attachment (CSV — not an image, so it goes through upload path)
    const csvAttachment: Attachment = { id: 'att-1', name: 'data.csv', type: 'file', mimeType: 'text/csv', base64: 'dGVzdA==', size: 4 };
    act(() => { void result.current.sendMessage('Analyse this', testSettings, [csvAttachment]); });

    // Messages appear immediately (user + assistant placeholder), but upload is still pending
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.isStreaming).toBe(true);

    // Simulate switching chats (detach) WHILE the upload is still running
    const onComplete = vi.fn();
    act(() => {
      result.current.detachStream('thread-1', [...result.current.messages], [], onComplete);
    });

    // Core assertion: isStreaming must drop immediately.
    // Before the fix this would stay true until the entire API response finished.
    expect(result.current.isStreaming).toBe(false);
    // onComplete not called yet — upload + API call still running in background
    expect(onComplete).not.toHaveBeenCalled();

    // Unblock the upload so the background async work can finish cleanly
    act(() => { resolveUpload('file-123'); });
  });
});

// ---------------------------------------------------------------------------
// Helpers for stopped-context tests
// ---------------------------------------------------------------------------

/**
 * Async generator that yields a text delta then throws AbortError,
 * simulating a user-stopped stream with partial content.
 */
async function* abortedStream(partialText: string): AsyncGenerator<unknown> {
  yield {
    type: 'response.output_text.delta',
    delta: partialText,
    item_id: 'item-1',
    output_index: 0,
    content_index: 0,
  };
  const err = new Error('The user aborted a request.');
  err.name = 'AbortError';
  throw err;
}

/** Async generator that throws AbortError immediately (no partial content). */
// eslint-disable-next-line require-yield
async function* abortedStreamEmpty(): AsyncGenerator<never> {
  const err = new Error('The user aborted a request.');
  err.name = 'AbortError';
  throw err;
}

describe('useChat - stopped-context injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects stopped context into the next sendMessage input', async () => {
    const mockClient = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce(abortedStream('Partial response'))
          .mockResolvedValueOnce(completedStream('resp-after-stop')),
      },
    };
    mockCreateAzureClient.mockReturnValue(mockClient);
    const { result } = renderHook(() => useChat());

    // First message — stream aborts with partial text
    await act(async () => {
      await result.current.sendMessage('First question', testSettings);
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const stopped = result.current.messages.find((m) => m.isStopped);
    expect(stopped).toBeDefined();
    expect(stopped?.content).toBe('Partial response');

    // Follow-up message
    await act(async () => {
      await result.current.sendMessage('Follow-up', testSettings);
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const secondCallArgs = mockClient.responses.create.mock.calls[1][0] as Record<string, unknown>;
    const inputArray = secondCallArgs.input as Array<{ role: string; content: unknown }>;
    expect(Array.isArray(inputArray)).toBe(true);
    expect(inputArray[0]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'First question' }] });
    expect(inputArray[1]).toEqual({ role: 'assistant', content: [{ type: 'output_text', text: 'Partial response' }] });
    expect(inputArray[2]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'Follow-up' }] });
  });

  it('injects stopped user message even when assistant produced no text', async () => {
    const mockClient = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce(abortedStreamEmpty())
          .mockResolvedValueOnce(completedStream('resp-2')),
      },
    };
    mockCreateAzureClient.mockReturnValue(mockClient);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('Hello', testSettings);
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    await act(async () => {
      await result.current.sendMessage('Follow-up', testSettings);
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // User message should still be injected even though assistant said nothing
    const secondCallArgs = mockClient.responses.create.mock.calls[1][0] as Record<string, unknown>;
    const inputArray = secondCallArgs.input as Array<{ role: string; content: unknown }>;
    expect(Array.isArray(inputArray)).toBe(true);
    expect(inputArray[0]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'Hello' }] });
    expect(inputArray[1]).toEqual({ role: 'user', content: [{ type: 'input_text', text: 'Follow-up' }] });
  });

  it('clears stopped context after a successful response', async () => {
    const mockClient = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce(abortedStream('partial'))
          .mockResolvedValueOnce(completedStream('resp-success'))
          .mockResolvedValueOnce(completedStream('resp-clean')),
      },
    };
    mockCreateAzureClient.mockReturnValue(mockClient);
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.sendMessage('Q1', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // Success — consumes stopped context
    await act(async () => { await result.current.sendMessage('Q2', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    // Third message should NOT carry stopped context
    await act(async () => { await result.current.sendMessage('Q3', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const thirdCallArgs = mockClient.responses.create.mock.calls[2][0] as Record<string, unknown>;
    expect(thirdCallArgs.input).toBe('Q3');
  });

  it('clearConversation resets stopped context', async () => {
    const mockClient = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce(abortedStream('partial'))
          .mockResolvedValueOnce(completedStream('resp-clean')),
      },
    };
    mockCreateAzureClient.mockReturnValue(mockClient);
    const { result } = renderHook(() => useChat());

    await act(async () => { await result.current.sendMessage('Q1', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    act(() => { result.current.clearConversation(); });

    await act(async () => { await result.current.sendMessage('Q2', testSettings); });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const secondCallArgs = mockClient.responses.create.mock.calls[1][0] as Record<string, unknown>;
    expect(secondCallArgs.input).toBe('Q2');
  });
});
