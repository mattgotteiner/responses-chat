/**
 * Stream processing utilities for handling OpenAI Responses API streaming events
 * 
 * This module provides pure functions for processing streaming events,
 * enabling both real-time UI updates and offline replay of recorded sessions.
 */

import type { ReasoningStep, ToolCall, Citation } from '../types';
import { generateReasoningId, generateToolCallId } from './api';

/** ID generator functions for customizable ID generation */
export interface IdGenerators {
  /** Generate a unique reasoning step ID */
  generateReasoningId: () => string;
  /** Generate a unique tool call ID */
  generateToolCallId: () => string;
}

/** Default ID generators using the api module functions */
export const defaultIdGenerators: IdGenerators = {
  generateReasoningId,
  generateToolCallId,
};

/** Raw streaming event from the OpenAI SDK */
export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

/** Accumulated state from processing stream events */
export interface StreamAccumulator {
  /** Accumulated text content from response.output_text.delta events */
  content: string;
  /** Accumulated reasoning steps from reasoning events */
  reasoning: ReasoningStep[];
  /** Accumulated tool calls from function_call events */
  toolCalls: ToolCall[];
  /** URL citations from web search annotations */
  citations: Citation[];
  /** Response ID from response.completed event (for conversation continuity) */
  responseId: string | null;
  /** Full response JSON from response.completed event */
  responseJson: Record<string, unknown> | null;
}

/** Create a fresh accumulator for a new stream */
export function createInitialAccumulator(): StreamAccumulator {
  return {
    content: '',
    reasoning: [],
    toolCalls: [],
    citations: [],
    responseId: null,
    responseJson: null,
  };
}

/**
 * Process a single streaming event and return the updated accumulator
 * 
 * This is a pure function: (accumulator, event) => newAccumulator
 * It does not mutate the input accumulator.
 * 
 * When delta is empty, the original accumulator is returned to avoid
 * unnecessary React state updates/rerenders in the UI.
 * 
 * @param accumulator - Current accumulated state
 * @param event - Streaming event from the API
 * @param idGenerators - Optional custom ID generators (for testing/replay)
 * @returns Updated accumulator with the event processed
 */
export function processStreamEvent(
  accumulator: StreamAccumulator,
  event: StreamEvent,
  idGenerators: IdGenerators = defaultIdGenerators
): StreamAccumulator {
  switch (event.type) {
    case 'response.output_text.delta': {
      const delta = (event as { delta?: string }).delta || '';
      // Short-circuit: return original accumulator when delta is empty
      // to avoid unnecessary React state updates/rerenders
      if (delta === '') {
        return accumulator;
      }
      return {
        ...accumulator,
        content: accumulator.content + delta,
      };
    }

    case 'response.output_item.added':
    case 'response.output_item.done': {
      // Handle reasoning output items with summary
      const itemEvent = event as {
        item?: {
          id?: string;
          type?: string;
          summary?: Array<{ type?: string; text?: string }>;
        };
      };

      if (itemEvent.item?.type === 'reasoning' && itemEvent.item.summary) {
        const summaryTexts = itemEvent.item.summary
          .filter((s) => s.type === 'summary_text' && s.text)
          .map((s) => s.text!);

        if (summaryTexts.length > 0) {
          const itemId = itemEvent.item.id || idGenerators.generateReasoningId();
          const content = summaryTexts.join('\n');

          // Find or update reasoning step
          const existingIndex = accumulator.reasoning.findIndex(
            (r) => r.id === itemId
          );

          const newReasoning = [...accumulator.reasoning];
          if (existingIndex >= 0) {
            newReasoning[existingIndex] = { ...newReasoning[existingIndex], content };
          } else {
            newReasoning.push({ id: itemId, content });
          }

          return {
            ...accumulator,
            reasoning: newReasoning,
          };
        }
      }
      return accumulator;
    }

    case 'response.reasoning.delta':
    case 'response.reasoning_summary_text.delta': {
      // Reasoning delta - use item_id + summary_index as unique key
      const reasoningEvent = event as {
        delta?: string;
        item_id?: string;
        summary_index?: number;
      };
      const delta = reasoningEvent.delta || '';
      // Short-circuit: return original accumulator when delta is empty
      // to avoid unnecessary React state updates/rerenders
      if (delta === '' && reasoningEvent.item_id) {
        // Only short-circuit if item_id exists (no new step needs to be created)
        const summaryIndex = reasoningEvent.summary_index ?? 0;
        const uniqueId = `${reasoningEvent.item_id}_${summaryIndex}`;
        const existingIndex = accumulator.reasoning.findIndex(
          (r) => r.id === uniqueId
        );
        if (existingIndex >= 0) {
          return accumulator;
        }
      }
      const itemId = reasoningEvent.item_id || idGenerators.generateReasoningId();
      const summaryIndex = reasoningEvent.summary_index ?? 0;
      const uniqueId = `${itemId}_${summaryIndex}`;

      // Find or create reasoning step
      const existingIndex = accumulator.reasoning.findIndex(
        (r) => r.id === uniqueId
      );

      const newReasoning = [...accumulator.reasoning];
      if (existingIndex >= 0) {
        newReasoning[existingIndex] = {
          ...newReasoning[existingIndex],
          content: newReasoning[existingIndex].content + delta,
        };
      } else {
        newReasoning.push({ id: uniqueId, content: delta });
      }

      return {
        ...accumulator,
        reasoning: newReasoning,
      };
    }

    case 'response.function_call_arguments.delta': {
      // Tool call delta
      const toolEvent = event as {
        delta?: string;
        item_id?: string;
        name?: string;
      };
      const delta = toolEvent.delta || '';
      // Short-circuit: return original accumulator when delta is empty
      // and the tool call already exists (to avoid unnecessary rerenders)
      if (delta === '' && toolEvent.item_id) {
        const existingIndex = accumulator.toolCalls.findIndex(
          (t) => t.id === toolEvent.item_id
        );
        if (existingIndex >= 0) {
          return accumulator;
        }
      }
      const itemId = toolEvent.item_id || idGenerators.generateToolCallId();

      // Find or create tool call
      const existingIndex = accumulator.toolCalls.findIndex(
        (t) => t.id === itemId
      );

      const newToolCalls = [...accumulator.toolCalls];
      if (existingIndex >= 0) {
        newToolCalls[existingIndex] = {
          ...newToolCalls[existingIndex],
          arguments: newToolCalls[existingIndex].arguments + delta,
        };
      } else {
        newToolCalls.push({
          id: itemId,
          name: toolEvent.name || 'unknown',
          arguments: delta,
        });
      }

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.completed': {
      // Response completed - extract response ID, full response, and citations
      const completedEvent = event as { response?: Record<string, unknown> };
      if (completedEvent.response) {
        const response = completedEvent.response;
        const responseId = typeof response.id === 'string' ? response.id : null;
        
        // Extract citations from output items
        const citations = extractCitationsFromResponse(response);
        
        return {
          ...accumulator,
          responseId,
          responseJson: response,
          citations: citations.length > 0 ? citations : accumulator.citations,
        };
      }
      return accumulator;
    }

    default:
      // Unknown event type - return accumulator unchanged
      return accumulator;
  }
}

/**
 * Process all events from a stream and return the final accumulated state
 * 
 * @param events - Iterable of streaming events
 * @param initialAccumulator - Optional initial state (defaults to empty)
 * @returns Final accumulated state after all events
 */
export async function processStream(
  events: AsyncIterable<StreamEvent> | Iterable<StreamEvent>,
  initialAccumulator?: StreamAccumulator
): Promise<StreamAccumulator> {
  let accumulator = initialAccumulator ?? createInitialAccumulator();

  for await (const event of events) {
    accumulator = processStreamEvent(accumulator, event);
  }

  return accumulator;
}

/**
 * Extract citations from a completed response
 * Citations are found in output items with type "message" that have annotations
 * 
 * @param response - The completed response object
 * @returns Array of extracted citations
 */
export function extractCitationsFromResponse(
  response: Record<string, unknown>
): Citation[] {
  const citations: Citation[] = [];
  
  const output = response.output;
  if (!Array.isArray(output)) {
    return citations;
  }
  
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    
    const outputItem = item as Record<string, unknown>;
    
    // Look for message items with content that has annotations
    if (outputItem.type === 'message') {
      const content = outputItem.content;
      if (!Array.isArray(content)) continue;
      
      for (const contentItem of content) {
        if (!contentItem || typeof contentItem !== 'object') continue;
        
        const c = contentItem as Record<string, unknown>;
        if (c.type !== 'output_text') continue;
        
        const annotations = c.annotations;
        if (!Array.isArray(annotations)) continue;
        
        for (const annotation of annotations) {
          if (!annotation || typeof annotation !== 'object') continue;
          
          const a = annotation as Record<string, unknown>;
          if (a.type !== 'url_citation') continue;
          
          if (
            typeof a.url === 'string' &&
            typeof a.title === 'string' &&
            typeof a.start_index === 'number' &&
            typeof a.end_index === 'number'
          ) {
            citations.push({
              url: a.url,
              title: a.title,
              startIndex: a.start_index,
              endIndex: a.end_index,
            });
          }
        }
      }
    }
  }
  
  // Deduplicate by URL
  const seen = new Set<string>();
  return citations.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}
