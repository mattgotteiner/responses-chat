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

/**
 * Build tools array and include list from settings
 * Extracted to avoid duplication between sendMessage and handleMcpApproval
 */
function buildToolsConfiguration(settings: Settings): {
  tools: Array<Record<string, unknown>>;
  include: string[];
} {
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
  /** Handle MCP tool call approval or denial */
  handleMcpApproval: (approvalRequestId: string, approve: boolean, settings: Settings) => Promise<void>;
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
  // Recording session ref - persists across sendMessage and handleMcpApproval
  // to support recording approval flows as a single session
  const recordingSessionRef = useRef<ReturnType<typeof createRecordingSession>>(null);

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

      // Add max output tokens if enabled
      if (settings.maxOutputTokensEnabled && settings.maxOutputTokens) {
        requestParams.max_output_tokens = settings.maxOutputTokens;
      }

      // Add tools configuration
      const { tools, include } = buildToolsConfiguration(settings);
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

      // Start recording session if RECORD mode is enabled
      // Store in ref so handleMcpApproval can continue using it
      const recordingSession = createRecordingSession();
      recordingSessionRef.current = recordingSession;

      // Track the accumulator to check for pending approvals at stream end
      let finalAccumulator: StreamAccumulator | null = null;

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
                    ...(acc.isTruncated && { isTruncated: true }),
                    ...(acc.truncationReason && { truncationReason: acc.truncationReason }),
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

        // Store final accumulator to check for pending approvals
        finalAccumulator = accumulator;

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
        
        setIsStreaming(false);
        abortControllerRef.current = null;
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
    setMessages([]);
    previousResponseIdRef.current = null;
    setError(null);
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

      // Add verbosity if provided (same as sendMessage)
      if (settings.verbosity) {
        requestParams.verbosity = settings.verbosity;
      }

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
      const targetMessageId = targetMessage.id;

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

        let accumulator = createInitialAccumulator();

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

          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === targetMessageId
                ? {
                    ...msg,
                    content: mergedContent,
                    reasoning: mergedReasoning,
                    toolCalls: mergedToolCalls,
                    ...(mergedCitations.length > 0 && { citations: mergedCitations }),
                    ...(acc.responseJson && { responseJson: acc.responseJson }),
                  }
                : msg
            )
          );
        };

        for await (const event of stream as AsyncIterable<StreamEvent>) {
          recordingSession?.recordEvent(event);
          const newAccumulator = processStreamEvent(accumulator, event);
          if (newAccumulator !== accumulator) {
            accumulator = newAccumulator;
            updateMessageFromAccumulator(accumulator);
          }
          if (accumulator.responseId) {
            previousResponseIdRef.current = accumulator.responseId;
          }
        }

        // Store final accumulator to check for pending approvals
        finalAccumulator = accumulator;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === targetMessageId ? { ...msg, isStreaming: false } : msg
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === targetMessageId
                ? { ...msg, isStreaming: false, isStopped: true }
                : msg
            )
          );
        } else {
          const errorMessage =
            err instanceof Error ? err.message : 'An unknown error occurred';
          setError(errorMessage);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === targetMessageId
                ? { ...msg, content: msg.content + `\n\nError: ${errorMessage}`, isStreaming: false, isError: true }
                : msg
            )
          );
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
        
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages]
  );

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearConversation,
    handleMcpApproval,
    error,
  };
}
