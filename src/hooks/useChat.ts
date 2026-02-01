/**
 * Hook for managing chat state and API interactions
 */

import { useState, useCallback, useRef } from 'react';
import type {
  Message,
  Settings,
  ReasoningStep,
  ToolCall,
} from '../types';
import {
  createAzureClient,
  generateMessageId,
  generateReasoningId,
  generateToolCallId,
} from '../utils/api';
import { createRecordingSession } from '../utils/recording';

/** Return type for the useChat hook */
export interface UseChatReturn {
  /** All messages in the conversation */
  messages: Message[];
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Send a message and get a streaming response */
  sendMessage: (content: string, settings: Settings) => Promise<void>;
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
 * // Clear conversation
 * clearConversation();
 */
export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousResponseIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, settings: Settings) => {
      if (!content.trim()) return;

      setError(null);

      // Add user message
      const userMessage: Message = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
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

      try {
        const client = createAzureClient(settings);
        const deployment = settings.deploymentName || settings.modelName;

        // Build the request parameters
        const requestParams: Record<string, unknown> = {
          model: deployment,
          input: content.trim(),
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

        // Use the responses API with streaming
        const stream = await client.responses.create({
          ...requestParams,
          stream: true,
        } as Parameters<typeof client.responses.create>[0]);

        let accumulatedContent = '';
        const accumulatedReasoning: ReasoningStep[] = [];
        const accumulatedToolCalls: ToolCall[] = [];

        // Start recording session if RECORD mode is enabled
        const recordingSession = createRecordingSession();

        // Process the stream - cast to async iterable since we set stream: true
        for await (const event of stream as AsyncIterable<{ type: string; [key: string]: unknown }>) {
          // Record event if recording is active
          recordingSession?.recordEvent(event);
          // Handle different event types
          if (event.type === 'response.output_text.delta') {
            // Text content delta
            const delta = (event as { delta?: string }).delta || '';
            accumulatedContent += delta;
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: accumulatedContent }
                  : msg
              )
            );
          } else if (
            event.type === 'response.output_item.added' ||
            event.type === 'response.output_item.done'
          ) {
            // Handle reasoning output items
            const itemEvent = event as {
              item?: {
                id?: string;
                type?: string;
                summary?: Array<{ type?: string; text?: string }>;
              };
            };
            
            if (itemEvent.item?.type === 'reasoning' && itemEvent.item.summary) {
              // Extract summary text from the reasoning item
              const summaryTexts = itemEvent.item.summary
                .filter((s) => s.type === 'summary_text' && s.text)
                .map((s) => s.text!);
              
              if (summaryTexts.length > 0) {
                const itemId = itemEvent.item.id || generateReasoningId();
                const content = summaryTexts.join('\n');
                
                // Find or update reasoning step
                const existingIndex = accumulatedReasoning.findIndex(
                  (r) => r.id === itemId
                );
                if (existingIndex >= 0) {
                  accumulatedReasoning[existingIndex].content = content;
                } else {
                  accumulatedReasoning.push({ id: itemId, content });
                }
                
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, reasoning: [...accumulatedReasoning] }
                      : msg
                  )
                );
              }
            }
          } else if (
            event.type === 'response.reasoning.delta' ||
            event.type === 'response.reasoning_summary_text.delta'
          ) {
            // Reasoning delta (includes both raw reasoning and reasoning summaries)
            // Use item_id + summary_index as unique key since there can be multiple summary parts
            const reasoningEvent = event as { delta?: string; item_id?: string; summary_index?: number };
            const delta = reasoningEvent.delta || '';
            const itemId = reasoningEvent.item_id || generateReasoningId();
            const summaryIndex = reasoningEvent.summary_index ?? 0;
            const uniqueId = `${itemId}_${summaryIndex}`;

            // Find or create reasoning step
            const existingIndex = accumulatedReasoning.findIndex(
              (r) => r.id === uniqueId
            );
            if (existingIndex >= 0) {
              accumulatedReasoning[existingIndex].content += delta;
            } else {
              accumulatedReasoning.push({ id: uniqueId, content: delta });
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, reasoning: [...accumulatedReasoning] }
                  : msg
              )
            );
          } else if (event.type === 'response.function_call_arguments.delta') {
            // Tool call delta
            const toolEvent = event as {
              delta?: string;
              item_id?: string;
              name?: string;
            };
            const delta = toolEvent.delta || '';
            const itemId = toolEvent.item_id || generateToolCallId();

            // Find or create tool call
            const existingIndex = accumulatedToolCalls.findIndex(
              (t) => t.id === itemId
            );
            if (existingIndex >= 0) {
              accumulatedToolCalls[existingIndex].arguments += delta;
            } else {
              accumulatedToolCalls.push({
                id: itemId,
                name: toolEvent.name || 'unknown',
                arguments: delta,
              });
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, toolCalls: [...accumulatedToolCalls] }
                  : msg
              )
            );
          } else if (event.type === 'response.completed') {
            // Response completed - extract the response ID
            const completedEvent = event as { response?: { id?: string } };
            if (completedEvent.response?.id) {
              previousResponseIdRef.current = completedEvent.response.id;
            }
          }
        }

        // Mark message as no longer streaming
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
          )
        );
      } catch (err) {
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
      } finally {
        // Finalize recording if active (even on error for debugging)
        recordingSession?.finalize();
        setIsStreaming(false);
      }
    },
    []
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    previousResponseIdRef.current = null;
    setError(null);
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearConversation,
    error,
  };
}
