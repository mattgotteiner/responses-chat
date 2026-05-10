/**
 * Hook for managing chat state and API interactions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { RateLimitError } from 'openai';
import type { Message, Settings, Attachment } from '../types';
import { supportsSamplingControls } from '../types';
import { createAzureClient, generateMessageId, uploadFileForCodeInterpreter } from '../utils/api';
import { createRecordingSession } from '../utils/recording';
import { isImageAttachment } from '../utils/attachment';
import {
  createInitialAccumulator,
  processStreamEvent,
  type StreamAccumulator,
  type StreamEvent,
} from '../utils/streamProcessor';

/**
 * Build tools array and include list from settings
 * Extracted to avoid duplication between sendMessage and handleMcpApproval
 */
function buildToolsConfiguration(settings: Settings, codeInterpreterFileIds?: string[]): {
  tools: Array<Record<string, unknown>>;
  include: string[];
} {
  const tools: Array<Record<string, unknown>> = [];
  const include: string[] = [];

  if (settings.webSearchEnabled) {
    const webSearchTool: Record<string, unknown> = { type: 'web_search' };
    if (settings.webSearchContextSize) {
      webSearchTool.search_context_size = settings.webSearchContextSize;
    }
    tools.push(webSearchTool);
  }
  if (settings.codeInterpreterEnabled) {
    // Include file_ids if any were uploaded for code interpreter
    const container: Record<string, unknown> = { type: 'auto' };
    if (codeInterpreterFileIds && codeInterpreterFileIds.length > 0) {
      container.file_ids = codeInterpreterFileIds;
    }
    tools.push({ type: 'code_interpreter', container });
    // Request code interpreter outputs to get execution results (logs)
    include.push('code_interpreter_call.outputs');
  }
  // Add file search tool if enabled with a vector store selected
  if (settings.fileSearchEnabled && settings.fileSearchVectorStoreId) {
    tools.push({
      type: 'file_search',
      vector_store_ids: [settings.fileSearchVectorStoreId],
    });
  }
  // Add enabled MCP servers as tools
  if (settings.mcpServers && settings.mcpServers.length > 0) {
    for (const server of settings.mcpServers) {
      if (server.enabled) {
        const mcpTool: Record<string, unknown> = {
          type: 'mcp',
          server_label: server.serverLabel,
          server_url: server.serverUrl,
          require_approval: server.requireApproval,
        };
        // Add headers if any are configured
        if (server.headers.length > 0) {
          const headers: Record<string, string> = {};
          for (const header of server.headers) {
            if (header.key.trim() && header.value.trim()) {
              headers[header.key.trim()] = header.value.trim();
            }
          }
          if (Object.keys(headers).length > 0) {
            mcpTool.headers = headers;
          }
        }
        tools.push(mcpTool);
      }
    }
  }

  return { tools, include };
}

function addSamplingParameters(requestParams: Record<string, unknown>, settings: Settings): void {
  if (!supportsSamplingControls(settings.modelName, settings.reasoningEffort)) {
    return;
  }

  if (settings.temperatureEnabled) {
    requestParams.temperature = settings.temperature ?? 1;
  }

  if (settings.topPEnabled) {
    requestParams.top_p = settings.topP ?? 1;
  }
}

function addTextParameters(requestParams: Record<string, unknown>, settings: Settings): void {
  if (!settings.verbosity) {
    return;
  }

  const existingText = requestParams.text;

  requestParams.text = {
    ...(typeof existingText === 'object' && existingText !== null
      ? existingText as Record<string, unknown>
      : {}),
    verbosity: settings.verbosity,
  };
}

/** State for a stream running in the background while the user views another thread */
type BackgroundStream = {
  threadId: string;
  messages: Message[];
  previousResponseId: string | null;
  uploadedFileIds: string[];
  abortController: AbortController;
  onComplete: (messages: Message[], prevResponseId: string | null, uploadedFileIds: string[]) => void;
};

type ResponsesInputItem = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getNestedRecord(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = source[key];
  return isRecord(value) ? value : null;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function toSerializableValue(value: unknown): string | number | boolean | null | undefined {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }
  return undefined;
}

function getErrorCode(err: unknown): string | undefined {
  const errorRecord = isRecord(err) ? err : null;
  const nestedError = errorRecord ? getNestedRecord(errorRecord, 'error') : null;

  return (
    toNonEmptyString(nestedError?.code) ??
    toNonEmptyString(errorRecord?.code)
  );
}

function isPreviousResponseNotFoundError(err: unknown): boolean {
  return (
    getErrorCode(err) === 'previous_response_not_found' ||
    (err instanceof Error && err.message.includes('previous_response_not_found'))
  );
}

function userTextInput(content: string): ResponsesInputItem {
  return {
    role: 'user',
    content: [{ type: 'input_text', text: content }],
  };
}

function assistantTextInput(content: string): ResponsesInputItem {
  return {
    role: 'assistant',
    content: [{ type: 'output_text', text: content }],
  };
}

function normalizeCurrentInput(input: unknown): ResponsesInputItem[] {
  if (typeof input === 'string') {
    return [userTextInput(input)];
  }

  if (Array.isArray(input)) {
    return input.filter(isRecord);
  }

  return [];
}

function buildFallbackHistoryInput(
  historyMessages: Message[],
  currentInput: unknown
): ResponsesInputItem[] {
  const historyInput = historyMessages.flatMap((message): ResponsesInputItem[] => {
    const content = message.content.trim();
    if (!content || message.isError) {
      return [];
    }

    return message.role === 'user'
      ? [userTextInput(content)]
      : [assistantTextInput(content)];
  });

  return [...historyInput, ...normalizeCurrentInput(currentInput)];
}

function buildPreviousResponseFallbackParams(
  requestParams: Record<string, unknown>,
  historyMessages: Message[]
): Record<string, unknown> {
  const fallbackParams = { ...requestParams };
  delete fallbackParams.previous_response_id;

  return {
    ...fallbackParams,
    input: buildFallbackHistoryInput(historyMessages, requestParams.input),
  };
}

function buildErrorResponseJson(
  err: unknown,
  errorMessage: string,
  existingResponseJson?: Record<string, unknown> | null
): { errorCode?: string; responseJson: Record<string, unknown> } {
  const errorRecord = isRecord(err) ? err : null;
  const nestedError = errorRecord ? getNestedRecord(errorRecord, 'error') : null;

  const errorCode =
    toNonEmptyString(nestedError?.code) ??
    toNonEmptyString(errorRecord?.code) ??
    (err instanceof RateLimitError ? 'rate_limit_exceeded' : undefined);

  const errorType =
    toNonEmptyString(nestedError?.type) ??
    toNonEmptyString(errorRecord?.type);

  const errorParam =
    toNonEmptyString(nestedError?.param) ??
    toNonEmptyString(errorRecord?.param);

  const statusCode =
    toSerializableValue(nestedError?.status) ??
    toSerializableValue(errorRecord?.status);

  const mergedError = {
    ...(existingResponseJson && isRecord(existingResponseJson.error) ? existingResponseJson.error : {}),
    ...(nestedError ?? {}),
    message: errorMessage,
    ...(errorCode && { code: errorCode }),
    ...(errorType && { type: errorType }),
    ...(errorParam && { param: errorParam }),
  };

  return {
    errorCode,
    responseJson: {
      ...(existingResponseJson ?? {}),
      ...(statusCode !== undefined && { status_code: statusCode }),
      status: 'failed',
      error: mergedError,
      ...(err instanceof Error && { error_name: err.name }),
    },
  };
}

export interface UseChatReturn {
  /** All messages in the conversation */
  messages: Message[];
  /** Whether a response is currently streaming in the foreground */
  isStreaming: boolean;
  /** Send a message and get a streaming response */
  sendMessage: (content: string, settings: Settings, attachments?: Attachment[]) => Promise<void>;
  /** Stop the current streaming response */
  stopStreaming: () => void;
  /** Clear all messages and reset conversation */
  clearConversation: () => void;
  /** Handle MCP tool call approval or denial */
  handleMcpApproval: (approvalRequestId: string, approve: boolean, settings: Settings) => Promise<void>;
  /** Retry a failed message by its assistant message ID */
  retryMessage: (failedAssistantMessageId: string, settings: Settings) => Promise<void>;
  /** Load a saved thread's state into the chat */
  loadThread: (messages: Message[], previousResponseId: string | null, uploadedFileIds: string[]) => void;
  /** Detach the current foreground stream to run in the background for the given thread */
  detachStream: (threadId: string, currentMessages: Message[], uploadedFileIds: string[], onComplete: (messages: Message[], prevResponseId: string | null, uploadedFileIds: string[]) => void) => void;
  /** Re-attach a background stream back to the foreground by thread ID; returns buffer or null */
  reattachStream: (threadId: string) => Message[] | null;
  /** Abort and discard any detached background stream for a thread ID */
  abortBackgroundStream: (threadId: string) => void;
  /** Get the current previousResponseId */
  previousResponseId: string | null;
  /** Uploaded file IDs available to code interpreter for the current chat */
  uploadedFileIds: string[];
  /** Any error that occurred */
  error: string | null;
}

/**
 * Hook for managing chat state and Azure OpenAI API interactions
 *
 * @example
 * const { messages, isStreaming, sendMessage, clearConversation } = useChat();
 *
 * // Send a message
 * await sendMessage('Hello!', settings);
 *
 * // Send a message with attachments
 * await sendMessage('What is in this image?', settings, [imageAttachment]);
 *
 * // Clear conversation
 * clearConversation();
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const previousResponseIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Map of assistantMessage.id → background stream state
  const backgroundStreamsRef = useRef<Map<string, BackgroundStream>>(new Map());
  // ID of the assistantMessage whose stream is currently in the foreground (null = no foreground stream)
  const foregroundStreamIdRef = useRef<string | null>(null);
  // Accumulated file IDs across all turns, so code interpreter can access files uploaded before it was enabled
  const allUploadedFileIdsRef = useRef<string[]>([]);
  // Recording session ref - persists across sendMessage and handleMcpApproval
  // to support recording approval flows as a single session
  const recordingSessionRef = useRef<ReturnType<typeof createRecordingSession>>(null);
  // Stopped-context queue: user+assistant turn pairs that were stopped before getting a
  // response ID. Injected into the next sendMessage input so the model can see them.
  const stoppedContextRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Abort all background streams on unmount to prevent dangling fetch requests
  useEffect(() => {
    const bgStreams = backgroundStreamsRef.current;
    return () => {
      for (const stream of bgStreams.values()) {
        stream.abortController.abort();
      }
      bgStreams.clear();
    };
  }, []);

  const sendMessage = useCallback(
    async (content: string, settings: Settings, attachments?: Attachment[]) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      setError(null);

      // Capture user text now for potential stopped-context injection later
      const pendingUserContent = content.trim();
      const fallbackHistoryMessages = messagesRef.current;

      const client = createAzureClient(settings);
      const deployment = settings.deploymentName || settings.modelName;

      // Separate attachments by type
      const imageAttachments = attachments?.filter(isImageAttachment) || [];
      const fileAttachments = attachments?.filter((a) => !isImageAttachment(a)) || [];
      
      // PDFs go to vision (input_file) and are also available to code interpreter when enabled
      const pdfAttachments = fileAttachments.filter((a) => a.mimeType === 'application/pdf');

      // Upload all attachments to Files API.
      // - Images go into the code interpreter container (file_ids) so CI can process them.
      //   They are NOT referenced as input_file (context stuffing rejects images); instead
      //   they are sent inline as input_image for vision.
      // - PDFs/other files go into the container AND are referenced as input_file for context stuffing.
      const attachmentsToUpload = [...imageAttachments, ...fileAttachments];
      
      // Determine which attachments need uploading
      const needsUpload = attachmentsToUpload.length > 0;
      
      // Mark attachments as "uploading"
      const attachmentsWithStatus = attachments?.map((a) => {
        if (needsUpload) {
          return { ...a, uploadStatus: 'uploading' as const };
        }
        return a;
      });

      // Generate message ID for user message so we can update it later
      const userMessageId = generateMessageId();

      // Add user message immediately (before uploads) so user sees their message
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content: content.trim(),
        attachments: attachmentsWithStatus && attachmentsWithStatus.length > 0 ? attachmentsWithStatus : undefined,
        timestamp: new Date(),
        // Request JSON will be updated after uploads complete
        requestJson: undefined,
      };

      // Create placeholder for assistant message
      const assistantMessage: Message = {
        id: generateMessageId(),
        role: 'assistant',
        content: '',
        reasoning: [],
        toolCalls: [],
        isStreaming: true,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const next = [...prev, userMessage, assistantMessage];
        messagesRef.current = next;
        return next;
      });
      // Create the AbortController NOW — before any async work — so detachStream can
      // find it even if the user switches chats while files are still uploading.
      // Capture as a local const so we can check signal.aborted after the finally
      // block sets the ref to null.
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsStreaming(true);
      foregroundStreamIdRef.current = assistantMessage.id;

      // Upload files to Files API - now happens after message is shown
      let uploadedFileIds: string[] = [];
      // Map attachment names to their uploaded file_ids (for referencing in input content)
      const uploadedFileIdMap = new Map<string, string>();
      if (needsUpload) {
        try {
          const uploadPromises = attachmentsToUpload.map((a) =>
            uploadFileForCodeInterpreter(client, {
              filename: a.name,
              base64: a.base64,
              mimeType: a.mimeType,
            })
          );
          uploadedFileIds = await Promise.all(uploadPromises);
          
          // Build mapping of attachment name to file_id
          attachmentsToUpload.forEach((a, index) => {
            uploadedFileIdMap.set(a.name, uploadedFileIds[index]);
          });

          // Accumulate file IDs across turns so code interpreter can access files from earlier turns
          allUploadedFileIdsRef.current = [...allUploadedFileIdsRef.current, ...uploadedFileIds];
          
          // Update user message attachments to show "uploaded" status
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMessageId && msg.attachments
                ? {
                    ...msg,
                    attachments: msg.attachments.map((a) =>
                      a.uploadStatus === 'uploading'
                        ? { ...a, uploadStatus: 'uploaded' as const }
                        : a
                    ),
                  }
                : msg
            )
          );
        } catch (uploadError) {
          const errorMessage = uploadError instanceof Error ? uploadError.message : 'Failed to upload files';
          setError(`File upload failed: ${errorMessage}`);
          
          // Update user message attachments to show "failed" status
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === userMessageId && msg.attachments) {
                return {
                  ...msg,
                  attachments: msg.attachments.map((a) =>
                    a.uploadStatus === 'uploading'
                      ? { ...a, uploadStatus: 'failed' as const }
                      : a
                  ),
                };
              }
              if (msg.id === assistantMessage.id) {
                return {
                  ...msg,
                  content: `Error: ${errorMessage}`,
                  isStreaming: false,
                  isError: true,
                };
              }
              return msg;
            })
          );
          setIsStreaming(false);
          return;
        }
      }

      // Build input: either simple string or structured content with attachments
      let input: string | Record<string, unknown>[];
      // Include images and PDFs in content parts (PDFs for vision, also uploaded to code interpreter above)
      const hasContentAttachments = imageAttachments.length > 0 || pdfAttachments.length > 0;
      
      if (hasContentAttachments) {
        // Build content array with text, images, and PDFs
        const contentParts: Record<string, unknown>[] = [];
        
        // Add text content if present
        if (content.trim()) {
          contentParts.push({ type: 'input_text', text: content.trim() });
        }
        
        // Add image attachments as inline base64 (vision)
        for (const attachment of imageAttachments) {
          contentParts.push({
            type: 'input_image',
            image_url: `data:${attachment.mimeType};base64,${attachment.base64}`,
            detail: 'auto',
          });
        }

        // Add PDF attachments using file_id references (for vision/model context)
        for (const attachment of pdfAttachments) {
          const uploadedFileId = uploadedFileIdMap.get(attachment.name);
          if (uploadedFileId) {
            contentParts.push({
              type: 'input_file',
              file_id: uploadedFileId,
            });
          }
        }
        
        // Wrap in message format
        input = [{ role: 'user', content: contentParts }];
      } else {
        input = content.trim();
      }

      // If there are stopped messages from a previous interrupted turn, inject them
      // before the new user message so the model can see the partial conversation.
      if (stoppedContextRef.current.length > 0) {
        const stoppedTurns = stoppedContextRef.current.map(({ role, content: c }) => ({
          role,
          content: role === 'user'
            ? [{ type: 'input_text', text: c }]
            : [{ type: 'output_text', text: c }],
        }));
        // Normalise the current user input to array form too
        const currentUserTurn = typeof input === 'string'
          ? { role: 'user', content: [{ type: 'input_text', text: input }] }
          : (input as Record<string, unknown>[])[0];
        input = [...stoppedTurns, currentUserTurn];
      }

      // Build the request parameters
      const requestParams: Record<string, unknown> = {
        model: deployment,
        input,
      };

      // Add previous response ID for conversation continuity
      if (previousResponseIdRef.current) {
        requestParams.previous_response_id = previousResponseIdRef.current;
      }

      // Add developer instructions if provided
      if (settings.developerInstructions?.trim()) {
        requestParams.instructions = settings.developerInstructions.trim();
      }

      // Add reasoning configuration if provided
      if (settings.reasoningEffort) {
        requestParams.reasoning = {
          effort: settings.reasoningEffort,
          ...(settings.reasoningSummary && {
            summary: settings.reasoningSummary,
          }),
        };
      }

      addTextParameters(requestParams, settings);

      addSamplingParameters(requestParams, settings);

      // Add max output tokens if enabled
      if (settings.maxOutputTokensEnabled && settings.maxOutputTokens) {
        requestParams.max_output_tokens = settings.maxOutputTokens;
      }

      // Add tools configuration (with file_ids for code interpreter if enabled)
      // Pass all accumulated file IDs so files uploaded before CI was enabled are still accessible
      const codeInterpreterFileIds = settings.codeInterpreterEnabled ? allUploadedFileIdsRef.current : undefined;
      const { tools, include } = buildToolsConfiguration(settings, codeInterpreterFileIds);
      if (tools.length > 0) {
        requestParams.tools = tools;
      }
      if (include.length > 0) {
        requestParams.include = include;
      }

      // Enable parallel tool calls if configured
      if (settings.parallelToolCallsEnabled) {
        requestParams.parallel_tool_calls = true;
      }

      // Update user message with the final request JSON (now that we know file IDs)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessageId
            ? { ...msg, requestJson: { ...requestParams, stream: true } }
            : msg
        )
      );

      // Start recording session if RECORD mode is enabled
      // Store in ref so handleMcpApproval can continue using it
      const recordingSession = createRecordingSession();
      recordingSessionRef.current = recordingSession;

      // Track the accumulator to check for pending approvals at stream end
      let finalAccumulator: StreamAccumulator | null = null;
      // Hoist accumulator so the catch block can read partial content on early abort
      let accumulator = createInitialAccumulator();

      try {
        // AbortController was created before file uploads (abortController above) — capture
        // local ref so we can check signal.aborted after the finally block sets the ref to null.
        // We do NOT create a new one here — that would replace the controller that
        // detachStream may have already stored in backgroundStreamsRef during the upload.

        // Record the request payload if recording is active
        recordingSession?.recordRequest(requestParams);

        // Use the responses API with streaming
        let activeRequestParams = requestParams;
        let stream: Awaited<ReturnType<typeof client.responses.create>>;
        try {
          stream = await client.responses.create(
            {
              ...activeRequestParams,
              stream: true,
            } as Parameters<typeof client.responses.create>[0],
            { signal: abortController.signal }
          );
        } catch (createError) {
          if (
            !activeRequestParams.previous_response_id ||
            !isPreviousResponseNotFoundError(createError)
          ) {
            throw createError;
          }

          activeRequestParams = buildPreviousResponseFallbackParams(
            activeRequestParams,
            fallbackHistoryMessages
          );
          previousResponseIdRef.current = null;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === userMessageId
                ? { ...msg, requestJson: { ...activeRequestParams, stream: true } }
                : msg
            )
          );
          recordingSession?.recordRequest(activeRequestParams);
          stream = await client.responses.create(
            {
              ...activeRequestParams,
              stream: true,
            } as Parameters<typeof client.responses.create>[0],
            { signal: abortController.signal }
          );
        }

        // Helper to update message state from accumulator
        const updateMessageFromAccumulator = (acc: StreamAccumulator) => {
          const applyUpdate = (prev: Message[]): Message[] =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content: acc.content,
                    reasoning: [...acc.reasoning],
                    toolCalls: [...acc.toolCalls],
                    ...(acc.citations.length > 0 && { citations: [...acc.citations] }),
                    ...(acc.fileCitations.length > 0 && { fileCitations: [...acc.fileCitations] }),
                    ...(acc.containerFileCitations.length > 0 && { containerFileCitations: [...acc.containerFileCitations] }),
                    ...(acc.responseJson && { responseJson: acc.responseJson }),
                    ...(acc.isTruncated && { isTruncated: true }),
                    ...(acc.truncationReason && { truncationReason: acc.truncationReason }),
                  }
                : msg
            );
          const bgStream = backgroundStreamsRef.current.get(assistantMessage.id);
          if (bgStream) {
            bgStream.messages = applyUpdate(bgStream.messages);
          } else {
            setMessages(applyUpdate);
          }
        };

        // Track whether we received a terminal event (response.completed / incomplete / failed)
        let streamCompletedNormally = false;

        // Process the stream using the stream processor
        for await (const event of stream as AsyncIterable<StreamEvent>) {
          // Record event if recording is active
          recordingSession?.recordEvent(event);

          // Process the event through the pure stream processor
          const newAccumulator = processStreamEvent(accumulator, event);

          // Update React state if accumulator changed
          if (newAccumulator !== accumulator) {
            accumulator = newAccumulator;
            updateMessageFromAccumulator(accumulator);
          }

          // Track response ID for conversation continuity (per-stream for background)
          if (accumulator.responseId) {
            const bgStream = backgroundStreamsRef.current.get(assistantMessage.id);
            if (bgStream) {
              bgStream.previousResponseId = accumulator.responseId;
            } else {
              previousResponseIdRef.current = accumulator.responseId;
              // Successful response subsumes any previously stopped context
              stoppedContextRef.current = [];
            }
            streamCompletedNormally = true;
            // Terminal event received (response.completed / response.incomplete / response.failed).
            // Break immediately so we don't wait for the transport to close — on mobile or
            // behind certain proxies the TCP connection can stay open indefinitely, which
            // would leave isStreaming=true and the input permanently disabled.
            break;
          }
        }

        // Store final accumulator to check for pending approvals
        finalAccumulator = accumulator;

        // The OpenAI SDK swallows AbortError internally and ends the stream cleanly,
        // so we detect user-initiated stops here by checking the abort signal directly.
        const isForegroundStream = !backgroundStreamsRef.current.has(assistantMessage.id);
        if (!streamCompletedNormally && isForegroundStream && abortController.signal.aborted) {
          // Foreground stream was stopped by user — save context so the next
          // sendMessage can inject this turn and the model can see it.
          const newEntries: Array<{ role: 'user' | 'assistant'; content: string }> = [
            { role: 'user', content: pendingUserContent },
          ];
          if (accumulator.content.trim()) {
            newEntries.push({ role: 'assistant', content: accumulator.content });
          }
          stoppedContextRef.current = [...stoppedContextRef.current, ...newEntries];
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, isStreaming: false, isStopped: true }
                : msg
            )
          );
        } else {
          // Normal completion, background stream, or stream ended without abort
          const completionUpdater = (prev: Message[]) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
            );
          const bgStreamComplete = backgroundStreamsRef.current.get(assistantMessage.id);
          if (bgStreamComplete) {
            bgStreamComplete.messages = completionUpdater(bgStreamComplete.messages);
            bgStreamComplete.onComplete(bgStreamComplete.messages, bgStreamComplete.previousResponseId, bgStreamComplete.uploadedFileIds);
            backgroundStreamsRef.current.delete(assistantMessage.id);
          } else {
            setMessages(completionUpdater);
          }
        }
      } catch (err) {
        // Handle user-initiated abort differently from errors
        if (err instanceof Error && err.name === 'AbortError') {
          // User stopped the stream - mark as stopped, preserve partial content.
          // Build the context entries we want to inject into the next sendMessage.
          const newEntries: Array<{ role: 'user' | 'assistant'; content: string }> = [
            { role: 'user', content: pendingUserContent },
          ];
          if (accumulator.content.trim()) {
            newEntries.push({ role: 'assistant', content: accumulator.content });
          }
          const abortUpdater = (prev: Message[]) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? { ...msg, isStreaming: false, isStopped: true }
                : msg
            );
          const bgStreamAbort = backgroundStreamsRef.current.get(assistantMessage.id);
          if (bgStreamAbort) {
            // Background stream aborted (e.g. thread deleted) — don't touch foreground context
            bgStreamAbort.messages = abortUpdater(bgStreamAbort.messages);
            bgStreamAbort.onComplete(bgStreamAbort.messages, bgStreamAbort.previousResponseId, bgStreamAbort.uploadedFileIds);
            backgroundStreamsRef.current.delete(assistantMessage.id);
          } else {
            // Foreground stream stopped by user — save context so next sendMessage can inject it
            stoppedContextRef.current = [...stoppedContextRef.current, ...newEntries];
            setMessages(abortUpdater);
          }
        } else {
          let errorMessage =
            err instanceof Error ? err.message : 'An unknown error occurred';

          // Provide actionable guidance for rate limit errors
          if (err instanceof RateLimitError) {
            errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
            if (settings.webSearchEnabled) {
              errorMessage += ' Web search significantly increases token usage — try disabling it or setting Search Context Size to "low".';
            }
          }

          setError(errorMessage);
          const { errorCode, responseJson } = buildErrorResponseJson(
            err,
            errorMessage,
            accumulator.responseJson
          );

          // Update assistant message to show error
          const errorUpdater = (prev: Message[]) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content: `Error: ${errorMessage}`,
                    isStreaming: false,
                    isError: true,
                    responseJson,
                    ...(errorCode && { errorCode }),
                  }
                : msg
            );
          const bgStreamError = backgroundStreamsRef.current.get(assistantMessage.id);
          if (bgStreamError) {
            bgStreamError.messages = errorUpdater(bgStreamError.messages);
            bgStreamError.onComplete(bgStreamError.messages, bgStreamError.previousResponseId, bgStreamError.uploadedFileIds);
            backgroundStreamsRef.current.delete(assistantMessage.id);
          } else {
            setMessages(errorUpdater);
          }
        }
      } finally {
        // Check for pending approvals - if any, don't finalize recording yet
        const hasPendingApprovals = finalAccumulator?.toolCalls.some(
          (tc) => tc.status === 'pending_approval'
        );
        
        if (!hasPendingApprovals) {
          // Finalize recording if active and no pending approvals
          recordingSession?.finalize();
          recordingSessionRef.current = null;
        }
        // If pending approvals, keep recording session alive for handleMcpApproval
        
        // Only clear foreground streaming state if this stream is still the foreground one.
        // If it was detached, isStreaming was already set to false by detachStream.
        if (foregroundStreamIdRef.current === assistantMessage.id) {
          setIsStreaming(false);
          abortControllerRef.current = null;
          foregroundStreamIdRef.current = null;
        }
      }
    },
    []
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      // Mark any in-progress tool calls as aborted
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.isStreaming && msg.toolCalls?.length) {
            return {
              ...msg,
              toolCalls: msg.toolCalls.map((tc) =>
                tc.status === 'in_progress' || tc.status === 'searching' || tc.status === 'interpreting'
                  ? { ...tc, status: 'aborted' as const }
                  : tc
              ),
            };
          }
          return msg;
        })
      );
    }
  }, []);

  const clearConversation = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
    previousResponseIdRef.current = null;
    allUploadedFileIdsRef.current = [];
    stoppedContextRef.current = [];
    setError(null);
  }, []);

  const loadThread = useCallback(
    (threadMessages: Message[], prevResponseId: string | null, uploadedFileIds: string[]) => {
      messagesRef.current = threadMessages;
      setMessages(threadMessages);
      previousResponseIdRef.current = prevResponseId;
      allUploadedFileIdsRef.current = uploadedFileIds;
      stoppedContextRef.current = [];
      setError(null);
    },
    []
  );

  /**
   * Detach the current foreground stream so it keeps running in the background.
   * `isStreaming` is set to false immediately; the stream writes to an internal
   * per-stream buffer keyed by assistantMessage.id. `onComplete` is called with
   * the final messages when the stream finishes.
   */
  const detachStream = useCallback(
    (threadId: string, currentMessages: Message[], uploadedFileIds: string[], onComplete: (messages: Message[], prevResponseId: string | null, uploadedFileIds: string[]) => void) => {
      const streamId = foregroundStreamIdRef.current;
      if (!streamId || !abortControllerRef.current) return;
      backgroundStreamsRef.current.set(streamId, {
        threadId,
        messages: [...currentMessages],
        previousResponseId: previousResponseIdRef.current,
        uploadedFileIds: [...uploadedFileIds],
        abortController: abortControllerRef.current,
        onComplete,
      });
      foregroundStreamIdRef.current = null;
      abortControllerRef.current = null; // prevent stop button from reaching this stream
      setIsStreaming(false);
    },
    []
  );

  /**
   * Re-attach a background stream back to the foreground by thread ID.
   * Returns the current buffer messages (to show live progress), or null if no
   * background stream exists for that thread.
   */
  const reattachStream = useCallback((threadId: string): Message[] | null => {
    let foundId: string | null = null;
    let foundStream: BackgroundStream | null = null;
    for (const [id, stream] of backgroundStreamsRef.current) {
      if (stream.threadId === threadId) {
        foundId = id;
        foundStream = stream;
        break;
      }
    }
    if (!foundId || !foundStream) return null;
    const buffer = [...foundStream.messages];
    backgroundStreamsRef.current.delete(foundId);
    foregroundStreamIdRef.current = foundId;
    abortControllerRef.current = foundStream.abortController;
    previousResponseIdRef.current = foundStream.previousResponseId;
    allUploadedFileIdsRef.current = foundStream.uploadedFileIds;
    messagesRef.current = buffer;
    setMessages(buffer);
    setIsStreaming(true);
    return buffer;
  }, []);

  const abortBackgroundStream = useCallback((threadId: string) => {
    for (const stream of backgroundStreamsRef.current.values()) {
      if (stream.threadId !== threadId) continue;
      // Deleting a thread should cancel background work without persisting final state.
      stream.onComplete = () => {};
      stream.abortController.abort();
    }
  }, []);

  const handleMcpApproval = useCallback(
    async (approvalRequestId: string, approve: boolean, settings: Settings) => {
      // Find the message containing this approval request
      let targetMessage: Message | undefined;
      let targetToolCallIndex = -1;

      for (const msg of messages) {
        if (msg.toolCalls) {
          const idx = msg.toolCalls.findIndex(
            (tc) => tc.approvalRequestId === approvalRequestId
          );
          if (idx >= 0) {
            targetMessage = msg;
            targetToolCallIndex = idx;
            break;
          }
        }
      }

      if (!targetMessage || targetToolCallIndex < 0) {
        setError('Could not find approval request');
        return;
      }

      // Update tool call status to approved or denied
      const newStatus = approve ? 'approved' as const : 'denied' as const;
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== targetMessage!.id || !msg.toolCalls) return msg;
          const newToolCalls = [...msg.toolCalls];
          newToolCalls[targetToolCallIndex] = {
            ...newToolCalls[targetToolCallIndex],
            status: newStatus,
          };
          return { ...msg, toolCalls: newToolCalls };
        })
      );

      // Must have a previous response ID to chain the response
      if (!previousResponseIdRef.current) {
        setError('No previous response to chain approval to');
        return;
      }

      setError(null);
      setIsStreaming(true);

      const client = createAzureClient(settings);
      const deployment = settings.deploymentName || settings.modelName;

      // Build the approval response input
      const approvalInput = {
        type: 'mcp_approval_response',
        approval_request_id: approvalRequestId,
        approve,
      };

      // Build request params
      const requestParams: Record<string, unknown> = {
        model: deployment,
        input: [approvalInput],
        previous_response_id: previousResponseIdRef.current,
      };

      // Add developer instructions if provided (same as sendMessage)
      if (settings.developerInstructions?.trim()) {
        requestParams.instructions = settings.developerInstructions.trim();
      }

      // Add reasoning configuration if provided (same as sendMessage)
      if (settings.reasoningEffort) {
        requestParams.reasoning = {
          effort: settings.reasoningEffort,
          ...(settings.reasoningSummary && {
            summary: settings.reasoningSummary,
          }),
        };
      }

      addTextParameters(requestParams, settings);

      addSamplingParameters(requestParams, settings);

      // Re-add tools configuration (required for continuing MCP calls)
      const { tools, include } = buildToolsConfiguration(settings);
      if (tools.length > 0) {
        requestParams.tools = tools;
      }
      if (include.length > 0) {
        requestParams.include = include;
      }

      // Continue streaming into the same message that had the approval request
      // Store the existing content and tool calls to append to
      // IMPORTANT: Update the tool call status in our local copy to match the setMessages update above
      // Otherwise the merge will overwrite the approved/denied status with the old pending_approval status
      const existingContent = targetMessage.content || '';
      const existingToolCalls = (targetMessage.toolCalls || []).map((tc, idx) =>
        idx === targetToolCallIndex ? { ...tc, status: newStatus } : tc
      );
      const existingReasoning = targetMessage.reasoning || [];
      const existingCitations = targetMessage.citations || [];
      const existingFileCitations = targetMessage.fileCitations || [];
      const existingContainerFileCitations = targetMessage.containerFileCitations || [];
      const targetMessageId = targetMessage.id;
      // Register as the foreground stream so detachStream can properly capture
      // and detach it if the user switches threads while the approval streams.
      foregroundStreamIdRef.current = targetMessageId;

      // Mark the target message as streaming again
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === targetMessageId ? { ...msg, isStreaming: true } : msg
        )
      );

      // Use existing recording session from sendMessage (if still active)
      // This keeps the entire approval flow in a single recording
      const recordingSession = recordingSessionRef.current;
      
      // Track final accumulator to check for more pending approvals at stream end
      let finalAccumulator: StreamAccumulator | null = null;

      let accumulator = createInitialAccumulator();

      try {
        abortControllerRef.current = new AbortController();
        recordingSession?.recordRequest(requestParams);

        const stream = await client.responses.create(
          {
            ...requestParams,
            stream: true,
          } as Parameters<typeof client.responses.create>[0],
          { signal: abortControllerRef.current.signal }
        );

        const updateMessageFromAccumulator = (acc: StreamAccumulator) => {
          // Merge existing content with new content from this continuation
          // Keep existing tool calls, append new ones from this stream
          const mergedToolCalls = [
            ...existingToolCalls,
            ...acc.toolCalls,
          ];
          
          // Append new content to existing content
          const mergedContent = existingContent + acc.content;
          
          // Merge reasoning and citations
          const mergedReasoning = [...existingReasoning, ...acc.reasoning];
          const mergedCitations = [...existingCitations, ...acc.citations];
          const mergedFileCitations = [...existingFileCitations, ...acc.fileCitations];
          const mergedContainerFileCitations = [...existingContainerFileCitations, ...acc.containerFileCitations];

          const applyUpdate = (prev: Message[]) =>
            prev.map((msg) =>
              msg.id === targetMessageId
                ? {
                    ...msg,
                    content: mergedContent,
                    reasoning: mergedReasoning,
                    toolCalls: mergedToolCalls,
                    ...(mergedCitations.length > 0 && { citations: mergedCitations }),
                    ...(mergedFileCitations.length > 0 && { fileCitations: mergedFileCitations }),
                    ...(mergedContainerFileCitations.length > 0 && { containerFileCitations: mergedContainerFileCitations }),
                    ...(acc.responseJson && { responseJson: acc.responseJson }),
                  }
                : msg
            );
          // Route to background buffer if the stream was detached while running
          const bgStream = backgroundStreamsRef.current.get(targetMessageId);
          if (bgStream) {
            bgStream.messages = applyUpdate(bgStream.messages);
          } else {
            setMessages(applyUpdate);
          }
        };

        for await (const event of stream as AsyncIterable<StreamEvent>) {
          recordingSession?.recordEvent(event);
          const newAccumulator = processStreamEvent(accumulator, event);
          if (newAccumulator !== accumulator) {
            accumulator = newAccumulator;
            updateMessageFromAccumulator(accumulator);
          }
          if (accumulator.responseId) {
            const bgStream = backgroundStreamsRef.current.get(targetMessageId);
            if (bgStream) {
              bgStream.previousResponseId = accumulator.responseId;
            } else {
              previousResponseIdRef.current = accumulator.responseId;
            }
            // Terminal event received — break so we don't hang waiting for transport close.
            break;
          }
        }

        // Store final accumulator to check for pending approvals
        finalAccumulator = accumulator;

        const completionUpdater = (prev: Message[]) =>
          prev.map((msg) =>
            msg.id === targetMessageId ? { ...msg, isStreaming: false } : msg
          );
        const bgStreamComplete = backgroundStreamsRef.current.get(targetMessageId);
        if (bgStreamComplete) {
          bgStreamComplete.messages = completionUpdater(bgStreamComplete.messages);
          bgStreamComplete.onComplete(bgStreamComplete.messages, bgStreamComplete.previousResponseId, bgStreamComplete.uploadedFileIds);
          backgroundStreamsRef.current.delete(targetMessageId);
        } else {
          setMessages(completionUpdater);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          const abortUpdater = (prev: Message[]) =>
            prev.map((msg) =>
              msg.id === targetMessageId
                ? { ...msg, isStreaming: false, isStopped: true }
                : msg
            );
          const bgStreamAbort = backgroundStreamsRef.current.get(targetMessageId);
          if (bgStreamAbort) {
            bgStreamAbort.messages = abortUpdater(bgStreamAbort.messages);
            bgStreamAbort.onComplete(bgStreamAbort.messages, bgStreamAbort.previousResponseId, bgStreamAbort.uploadedFileIds);
            backgroundStreamsRef.current.delete(targetMessageId);
          } else {
            setMessages(abortUpdater);
          }
        } else {
          let errorMessage =
            err instanceof Error ? err.message : 'An unknown error occurred';

          if (err instanceof RateLimitError) {
            errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          }

          setError(errorMessage);
          const { errorCode, responseJson } = buildErrorResponseJson(
            err,
            errorMessage,
            accumulator.responseJson
          );
          const errorUpdater = (prev: Message[]) =>
            prev.map((msg) =>
              msg.id === targetMessageId
                ? {
                    ...msg,
                    content: msg.content + `\n\nError: ${errorMessage}`,
                    isStreaming: false,
                    isError: true,
                    responseJson,
                    ...(errorCode && { errorCode }),
                  }
                : msg
            );
          const bgStreamError = backgroundStreamsRef.current.get(targetMessageId);
          if (bgStreamError) {
            bgStreamError.messages = errorUpdater(bgStreamError.messages);
            bgStreamError.onComplete(bgStreamError.messages, bgStreamError.previousResponseId, bgStreamError.uploadedFileIds);
            backgroundStreamsRef.current.delete(targetMessageId);
          } else {
            setMessages(errorUpdater);
          }
        }
      } finally {
        // Check for pending approvals - if any, don't finalize recording yet
        const hasPendingApprovals = finalAccumulator?.toolCalls.some(
          (tc) => tc.status === 'pending_approval'
        );
        
        if (!hasPendingApprovals) {
          // Finalize recording if active and no more pending approvals
          recordingSession?.finalize();
          recordingSessionRef.current = null;
        }
        // If pending approvals, keep recording session alive for next approval
        
        // Only clear foreground streaming state if this stream is still the foreground one.
        // If it was detached, isStreaming was already cleared by detachStream.
        if (foregroundStreamIdRef.current === targetMessageId) {
          setIsStreaming(false);
          abortControllerRef.current = null;
          foregroundStreamIdRef.current = null;
        }
      }
    },
    [messages]
  );

  const retryMessage = useCallback(
    async (failedAssistantMessageId: string, settings: Settings) => {
      const failedIdx = messages.findIndex(
        (m) => m.id === failedAssistantMessageId && m.isError
      );
      if (failedIdx < 0) return;

      const userMessage = messages[failedIdx - 1];
      if (!userMessage || userMessage.role !== 'user') return;

      // Restore previousResponseIdRef to the value it held before this failed call
      const priorResponseId =
        (userMessage.requestJson?.previous_response_id as string | null | undefined) ?? null;
      previousResponseIdRef.current = priorResponseId;

      // Remove the failed assistant message and its preceding user message
      const trimmedMessages = messages.slice(0, failedIdx - 1);
      messagesRef.current = trimmedMessages;
      setMessages(trimmedMessages);

      await sendMessage(userMessage.content, settings, userMessage.attachments);
    },
    [messages, sendMessage]
  );

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearConversation,
    handleMcpApproval,
    retryMessage,
    loadThread,
    detachStream,
    reattachStream,
    abortBackgroundStream,
    previousResponseId: previousResponseIdRef.current,
    uploadedFileIds: allUploadedFileIdsRef.current,
    error,
  };
}
