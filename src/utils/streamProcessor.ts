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
          status?: string;
          summary?: Array<{ type?: string; text?: string }>;
          action?: { type?: string; query?: string };
        };
      };

      if (itemEvent.item?.type === 'reasoning' && itemEvent.item.summary) {
        const itemId = itemEvent.item.id || idGenerators.generateReasoningId();
        let newReasoning: typeof accumulator.reasoning | null = null;
        let didChange = false;

        // Process each summary entry with its own index-based ID
        // This matches the IDs used by delta events: `${item_id}_${summary_index}`
        itemEvent.item.summary.forEach((s, summaryIndex) => {
          if (s.type !== 'summary_text' || !s.text) return;

          const uniqueId = `${itemId}_${summaryIndex}`;
          // Lazily clone the array only when we find the first change
          if (!newReasoning) {
            newReasoning = [...accumulator.reasoning];
          }
          const existingIndex = newReasoning.findIndex((r) => r.id === uniqueId);

          if (existingIndex >= 0) {
            // Update existing entry with final content
            newReasoning[existingIndex] = { ...newReasoning[existingIndex], content: s.text };
            didChange = true;
          } else {
            // Add new entry (shouldn't happen if deltas came first, but handle it)
            newReasoning.push({ id: uniqueId, content: s.text });
            didChange = true;
          }
        });

        if (didChange && newReasoning) {
          return {
            ...accumulator,
            reasoning: newReasoning,
          };
        }
      }

      // Handle web_search_call output items
      if (itemEvent.item?.type === 'web_search_call') {
        const itemId = itemEvent.item.id || idGenerators.generateToolCallId();
        const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
        const newToolCalls = [...accumulator.toolCalls];

        const status = itemEvent.item.status as 'in_progress' | 'searching' | 'completed' | undefined;
        const query = itemEvent.item.action?.query;

        if (existingIndex >= 0) {
          // Update existing tool call
          newToolCalls[existingIndex] = {
            ...newToolCalls[existingIndex],
            ...(status && { status }),
            ...(query && { query, arguments: JSON.stringify({ query }) }),
          };
        } else {
          // Add new web search call
          newToolCalls.push({
            id: itemId,
            name: 'web_search',
            type: 'web_search',
            arguments: query ? JSON.stringify({ query }) : '',
            status: status || 'in_progress',
            query,
          });
        }

        return {
          ...accumulator,
          toolCalls: newToolCalls,
        };
      }

      // Handle code_interpreter_call output items
      if (itemEvent.item?.type === 'code_interpreter_call') {
        const codeInterpreterItem = itemEvent.item as {
          id?: string;
          type?: string;
          status?: string;
          code?: string;
          container_id?: string;
          outputs?: Array<{ type?: string; logs?: string }>;
        };
        const itemId = codeInterpreterItem.id || idGenerators.generateToolCallId();
        const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
        const newToolCalls = [...accumulator.toolCalls];

        const status = codeInterpreterItem.status as 'in_progress' | 'interpreting' | 'completed' | undefined;
        const code = codeInterpreterItem.code;
        const containerId = codeInterpreterItem.container_id;
        // Extract logs output if present (API returns 'outputs' plural)
        const outputLogs = codeInterpreterItem.outputs
          ?.filter((o) => o.type === 'logs')
          .map((o) => o.logs || '')
          .join('\n');

        if (existingIndex >= 0) {
          // Update existing tool call
          newToolCalls[existingIndex] = {
            ...newToolCalls[existingIndex],
            ...(status && { status }),
            ...(code && { code }),
            ...(containerId && { containerId }),
            ...(outputLogs && { output: outputLogs }),
          };
        } else {
          // Add new code interpreter call
          newToolCalls.push({
            id: itemId,
            name: 'code_interpreter',
            type: 'code_interpreter',
            arguments: '',
            status: status || 'in_progress',
            code: code || '',
            containerId,
            output: outputLogs,
          });
        }

        return {
          ...accumulator,
          toolCalls: newToolCalls,
        };
      }

      // Handle mcp_call output items (remote MCP server tool invocations)
      if (itemEvent.item?.type === 'mcp_call') {
        const mcpItem = itemEvent.item as {
          id?: string;
          type?: string;
          status?: string;
          name?: string;
          server_label?: string;
          arguments?: string;
          output?: string;
          error?: string;
        };
        const itemId = mcpItem.id || idGenerators.generateToolCallId();
        const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
        const newToolCalls = [...accumulator.toolCalls];

        const status = mcpItem.status as 'in_progress' | 'completed' | 'aborted' | undefined;
        const toolName = mcpItem.name || 'mcp_tool';
        const serverLabel = mcpItem.server_label;
        // Build the display name: server_label/toolName if both present
        const displayName = serverLabel ? `${serverLabel}/${toolName}` : toolName;
        const args = mcpItem.arguments || '';
        const output = mcpItem.output;
        const error = mcpItem.error;

        if (existingIndex >= 0) {
          // Update existing tool call - also update name/type if they were placeholders
          newToolCalls[existingIndex] = {
            ...newToolCalls[existingIndex],
            // Update name from placeholder to actual name when available
            ...(displayName !== 'mcp_tool' && { name: displayName }),
            type: 'mcp',
            ...(status && { status }),
            ...(args && { arguments: args }),
            ...(output && { result: output }),
            ...(error && { result: `Error: ${error}` }),
          };
        } else {
          // Add new MCP call
          newToolCalls.push({
            id: itemId,
            name: serverLabel ? `${serverLabel}/${toolName}` : toolName,
            type: 'mcp',
            arguments: args,
            status: status || 'in_progress',
            result: output || error ? (error ? `Error: ${error}` : output) : undefined,
          });
        }

        return {
          ...accumulator,
          toolCalls: newToolCalls,
        };
      }

      return accumulator;
    }

    case 'response.web_search_call.in_progress':
    case 'response.web_search_call.searching':
    case 'response.web_search_call.completed': {
      // Update web search call status
      const webSearchEvent = event as { item_id?: string };
      const itemId = webSearchEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
      if (existingIndex < 0) return accumulator;

      const newStatus = event.type === 'response.web_search_call.completed'
        ? 'completed'
        : event.type === 'response.web_search_call.searching'
          ? 'searching'
          : 'in_progress';

      const newToolCalls = [...accumulator.toolCalls];
      newToolCalls[existingIndex] = {
        ...newToolCalls[existingIndex],
        status: newStatus,
      };

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.code_interpreter_call.in_progress':
    case 'response.code_interpreter_call.interpreting':
    case 'response.code_interpreter_call.completed': {
      // Update code interpreter call status
      const codeInterpreterEvent = event as { item_id?: string };
      const itemId = codeInterpreterEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
      if (existingIndex < 0) return accumulator;

      const newStatus = event.type === 'response.code_interpreter_call.completed'
        ? 'completed'
        : event.type === 'response.code_interpreter_call.interpreting'
          ? 'interpreting'
          : 'in_progress';

      const newToolCalls = [...accumulator.toolCalls];
      newToolCalls[existingIndex] = {
        ...newToolCalls[existingIndex],
        status: newStatus,
      };

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.mcp_call.in_progress':
    case 'response.mcp_call.completed': {
      // Update MCP call status
      const mcpEvent = event as { item_id?: string };
      const itemId = mcpEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
      if (existingIndex < 0) return accumulator;

      const newStatus = event.type === 'response.mcp_call.completed'
        ? 'completed'
        : 'in_progress';

      const newToolCalls = [...accumulator.toolCalls];
      newToolCalls[existingIndex] = {
        ...newToolCalls[existingIndex],
        status: newStatus,
      };

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.mcp_call_arguments.delta': {
      // Accumulate MCP call arguments from streaming delta events
      const mcpArgsEvent = event as { item_id?: string; delta?: string };
      const delta = mcpArgsEvent.delta || '';
      const itemId = mcpArgsEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);

      // Short-circuit on empty delta if the tool call already exists
      if (delta === '' && existingIndex >= 0) {
        return accumulator;
      }

      const newToolCalls = [...accumulator.toolCalls];

      if (existingIndex >= 0) {
        newToolCalls[existingIndex] = {
          ...newToolCalls[existingIndex],
          arguments: (newToolCalls[existingIndex].arguments || '') + delta,
        };
      } else {
        // Create new entry if it doesn't exist yet
        newToolCalls.push({
          id: itemId,
          name: 'mcp_tool',
          type: 'mcp',
          arguments: delta,
          status: 'in_progress',
        });
      }

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.mcp_call_arguments.done': {
      // Capture final complete MCP call arguments
      const mcpArgsEvent = event as { item_id?: string; arguments?: string };
      const args = mcpArgsEvent.arguments || '';
      const itemId = mcpArgsEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
      const newToolCalls = [...accumulator.toolCalls];

      if (existingIndex >= 0) {
        // Update with final complete arguments
        newToolCalls[existingIndex] = {
          ...newToolCalls[existingIndex],
          arguments: args,
        };
      } else {
        // Create new entry if it doesn't exist yet
        newToolCalls.push({
          id: itemId,
          name: 'mcp_tool',
          type: 'mcp',
          arguments: args,
          status: 'in_progress',
        });
      }

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.code_interpreter_call.code.delta':
    case 'response.code_interpreter_call_code.delta': {
      // Accumulate code for code interpreter
      // Both event name formats are supported (API uses underscores: code_interpreter_call_code)
      const codeEvent = event as { item_id?: string; delta?: string };
      const delta = codeEvent.delta || '';
      const itemId = codeEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);

      // Short-circuit on empty delta if the tool call already exists
      if (delta === '' && existingIndex >= 0) {
        return accumulator;
      }

      const newToolCalls = [...accumulator.toolCalls];

      if (existingIndex >= 0) {
        newToolCalls[existingIndex] = {
          ...newToolCalls[existingIndex],
          code: (newToolCalls[existingIndex].code || '') + delta,
        };
      } else {
        // Create new entry if it doesn't exist yet
        newToolCalls.push({
          id: itemId,
          name: 'code_interpreter',
          type: 'code_interpreter',
          arguments: '',
          status: 'in_progress',
          code: delta,
        });
      }

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.code_interpreter_call.code.done':
    case 'response.code_interpreter_call_code.done': {
      // Capture final complete code for code interpreter
      // Both event name formats are supported (API uses underscores: code_interpreter_call_code)
      const codeEvent = event as { item_id?: string; code?: string };
      const code = codeEvent.code || '';
      const itemId = codeEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
      const newToolCalls = [...accumulator.toolCalls];

      if (existingIndex >= 0) {
        // Update with final complete code
        newToolCalls[existingIndex] = {
          ...newToolCalls[existingIndex],
          code,
        };
      } else {
        // Create new entry if it doesn't exist yet
        newToolCalls.push({
          id: itemId,
          name: 'code_interpreter',
          type: 'code_interpreter',
          arguments: '',
          status: 'in_progress',
          code,
        });
      }

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
    }

    case 'response.code_interpreter_call.output':
    case 'response.code_interpreter_call_outputs.done': {
      // Capture code interpreter output (supports both singular and plural event names)
      const outputEvent = event as {
        item_id?: string;
        output?: Array<{ type?: string; logs?: string }>;
        outputs?: Array<{ type?: string; logs?: string }>;
      };
      const itemId = outputEvent.item_id;
      if (!itemId) return accumulator;

      const existingIndex = accumulator.toolCalls.findIndex((t) => t.id === itemId);
      if (existingIndex < 0) return accumulator;

      // Support both 'output' and 'outputs' property names
      const outputArray = outputEvent.outputs || outputEvent.output;
      const logs = outputArray
        ?.filter((o) => o.type === 'logs')
        .map((o) => o.logs || '')
        .join('\n') || '';

      const newToolCalls = [...accumulator.toolCalls];
      newToolCalls[existingIndex] = {
        ...newToolCalls[existingIndex],
        output: logs,
      };

      return {
        ...accumulator,
        toolCalls: newToolCalls,
      };
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
          type: 'function',
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
