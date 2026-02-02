/**
 * Hook for managing chat state and API interactions
 */

import { useState, useCallback, useRef } from 'react';
import type { Message, Settings, Attachment } from '../types';
import { createAzureClient, generateMessageId } from '../utils/api';
import { createRecordingSession } from '../utils/recording';
import { isImageAttachment } from '../utils/attachment';
import {
  createInitialAccumulator,
  processStreamEvent,
  type StreamAccumulator,
  type StreamEvent,
} from '../utils/streamProcessor';

/** Return type for the useChat hook */
export interface UseChatReturn {
  /** All messages in the conversation */
  messages: Message[];
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Send a message and get a streaming response */
  sendMessage: (content: string, settings: Settings, attachments?: Attachment[]) => Promise<void>;
  /** Stop the current streaming response */
  stopStreaming: () => void;
  /** Clear all messages and reset conversation */
  clearConversation: () => void;
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
  const previousResponseIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string, settings: Settings, attachments?: Attachment[]) => {
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      setError(null);

      const client = createAzureClient(settings);
      const deployment = settings.deploymentName || settings.modelName;

      // Build input: either simple string or structured content with attachments
      let input: string | Record<string, unknown>[];
      if (attachments && attachments.length > 0) {
        // Build content array with text and attachments
        const contentParts: Record<string, unknown>[] = [];
        
        // Add text content if present
        if (content.trim()) {
          contentParts.push({ type: 'input_text', text: content.trim() });
        }
        
        // Add attachments
        for (const attachment of attachments) {
          if (isImageAttachment(attachment)) {
            // Image attachment
            contentParts.push({
              type: 'input_image',
              image_url: `data:${attachment.mimeType};base64,${attachment.base64}`,
            });
          } else {
            // File attachment (PDF)
            contentParts.push({
              type: 'input_file',
              filename: attachment.name,
              file_data: `data:${attachment.mimeType};base64,${attachment.base64}`,
            });
          }
        }
        
        // Wrap in message format
        input = [{ role: 'user', content: contentParts }];
      } else {
        input = content.trim();
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

      // Add verbosity if provided
      if (settings.verbosity) {
        requestParams.verbosity = settings.verbosity;
      }

      // Add tools if enabled
      const tools: Array<Record<string, unknown>> = [];
      const include: string[] = [];
      if (settings.webSearchEnabled) {
        tools.push({ type: 'web_search_preview' });
      }
      if (settings.codeInterpreterEnabled) {
        tools.push({ type: 'code_interpreter', container: { type: 'auto' } });
        // Request code interpreter outputs to get execution results (logs)
        include.push('code_interpreter_call.outputs');
      }
      if (tools.length > 0) {
        requestParams.tools = tools;
      }
      if (include.length > 0) {
        requestParams.include = include;
      }

      // Add user message with request JSON
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        timestamp: new Date(),
        requestJson: { ...requestParams, stream: true },
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

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      // Start recording session if RECORD mode is enabled (declared here for finally block access)
      const recordingSession = createRecordingSession();

      try {
        // Create abort controller for this request
        abortControllerRef.current = new AbortController();

        // Record the request payload if recording is active
        recordingSession?.recordRequest(requestParams);

        // Use the responses API with streaming
        const stream = await client.responses.create(
          {
            ...requestParams,
            stream: true,
          } as Parameters<typeof client.responses.create>[0],
          { signal: abortControllerRef.current.signal }
        );

        let accumulator = createInitialAccumulator();

        // Helper to update message state from accumulator
        const updateMessageFromAccumulator = (acc: StreamAccumulator) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content: acc.content,
                    reasoning: [...acc.reasoning],
                    toolCalls: [...acc.toolCalls],
                    ...(acc.citations.length > 0 && { citations: [...acc.citations] }),
                    ...(acc.responseJson && { responseJson: acc.responseJson }),
                  }
                : msg
            )
          );
        };

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

          // Track response ID for conversation continuity
          if (accumulator.responseId) {
            previousResponseIdRef.current = accumulator.responseId;
          }
        }

        // Mark message as no longer streaming
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
          )
        );
      } catch (err) {
        // Handle user-initiated abort differently from errors
        if (err instanceof Error && err.name === 'AbortError') {
          // User stopped the stream - mark as stopped, preserve partial content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    isStreaming: false,
                    isStopped: true,
                  }
                : msg
            )
          );
        } else {
          const errorMessage =
            err instanceof Error ? err.message : 'An unknown error occurred';
          setError(errorMessage);

          // Update assistant message to show error
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id
                ? {
                    ...msg,
                    content: `Error: ${errorMessage}`,
                    isStreaming: false,
                    isError: true,
                  }
                : msg
            )
          );
        }
      } finally {
        // Finalize recording if active (even on error for debugging)
        recordingSession?.finalize();
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    []
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    previousResponseIdRef.current = null;
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearConversation,
    error,
  };
}
