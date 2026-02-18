import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialAccumulator,
  processStreamEvent,
  processStream,
  extractCitationsFromResponse,
  defaultIdGenerators,
  type StreamAccumulator,
  type StreamEvent,
  type IdGenerators,
} from './streamProcessor';

describe('streamProcessor', () => {
  describe('createInitialAccumulator', () => {
    it('creates an empty accumulator', () => {
      const acc = createInitialAccumulator();
      expect(acc.content).toBe('');
      expect(acc.reasoning).toEqual([]);
      expect(acc.toolCalls).toEqual([]);
      expect(acc.citations).toEqual([]);
      expect(acc.responseId).toBeNull();
      expect(acc.responseJson).toBeNull();
    });
  });

  describe('processStreamEvent', () => {
    let accumulator: StreamAccumulator;

    beforeEach(() => {
      accumulator = createInitialAccumulator();
    });

    describe('response.output_text.delta', () => {
      it('accumulates text content', () => {
        const event: StreamEvent = {
          type: 'response.output_text.delta',
          delta: 'Hello',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.content).toBe('Hello');
      });

      it('appends to existing content', () => {
        accumulator = { ...accumulator, content: 'Hello ' };
        const event: StreamEvent = {
          type: 'response.output_text.delta',
          delta: 'world!',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.content).toBe('Hello world!');
      });

      it('returns same accumulator for empty delta (to avoid rerenders)', () => {
        const event: StreamEvent = {
          type: 'response.output_text.delta',
          delta: '',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator); // Same reference
        expect(result.content).toBe('');
      });

      it('returns same accumulator for missing delta (to avoid rerenders)', () => {
        const event: StreamEvent = {
          type: 'response.output_text.delta',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator); // Same reference
        expect(result.content).toBe('');
      });

      it('does not mutate original accumulator', () => {
        const event: StreamEvent = {
          type: 'response.output_text.delta',
          delta: 'test',
        };
        processStreamEvent(accumulator, event);
        expect(accumulator.content).toBe('');
      });
    });

    describe('response.reasoning_summary_text.delta', () => {
      it('creates a new reasoning step', () => {
        const event: StreamEvent = {
          type: 'response.reasoning_summary_text.delta',
          delta: 'Thinking...',
          item_id: 'rs_123',
          summary_index: 0,
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.reasoning).toHaveLength(1);
        expect(result.reasoning[0].id).toBe('rs_123_0');
        expect(result.reasoning[0].content).toBe('Thinking...');
      });

      it('appends to existing reasoning step with same id', () => {
        accumulator = {
          ...accumulator,
          reasoning: [{ id: 'rs_123_0', content: 'First part ' }],
        };
        const event: StreamEvent = {
          type: 'response.reasoning_summary_text.delta',
          delta: 'second part',
          item_id: 'rs_123',
          summary_index: 0,
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.reasoning).toHaveLength(1);
        expect(result.reasoning[0].content).toBe('First part second part');
      });

      it('handles multiple summary indices', () => {
        const events: StreamEvent[] = [
          {
            type: 'response.reasoning_summary_text.delta',
            delta: 'Summary 0',
            item_id: 'rs_123',
            summary_index: 0,
          },
          {
            type: 'response.reasoning_summary_text.delta',
            delta: 'Summary 1',
            item_id: 'rs_123',
            summary_index: 1,
          },
        ];

        let result = accumulator;
        for (const event of events) {
          result = processStreamEvent(result, event);
        }

        expect(result.reasoning).toHaveLength(2);
        expect(result.reasoning[0].id).toBe('rs_123_0');
        expect(result.reasoning[1].id).toBe('rs_123_1');
      });

      it('defaults summary_index to 0', () => {
        const event: StreamEvent = {
          type: 'response.reasoning_summary_text.delta',
          delta: 'Thinking...',
          item_id: 'rs_123',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.reasoning[0].id).toBe('rs_123_0');
      });

      it('returns same accumulator for empty delta when step exists (to avoid rerenders)', () => {
        accumulator = {
          ...accumulator,
          reasoning: [{ id: 'rs_123_0', content: 'Existing' }],
        };
        const event: StreamEvent = {
          type: 'response.reasoning_summary_text.delta',
          delta: '',
          item_id: 'rs_123',
          summary_index: 0,
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator); // Same reference
      });

      it('uses custom ID generator when item_id is missing', () => {
        const customGenerators: IdGenerators = {
          generateReasoningId: () => 'custom_reason_id',
          generateToolCallId: () => 'custom_tool_id',
        };
        const event: StreamEvent = {
          type: 'response.reasoning_summary_text.delta',
          delta: 'Thinking...',
          summary_index: 0,
        };
        const result = processStreamEvent(accumulator, event, customGenerators);
        expect(result.reasoning[0].id).toBe('custom_reason_id_0');
      });
    });

    describe('response.function_call_arguments.delta', () => {
      it('creates a new tool call', () => {
        const event: StreamEvent = {
          type: 'response.function_call_arguments.delta',
          delta: '{"key":',
          item_id: 'tool_123',
          name: 'my_function',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('tool_123');
        expect(result.toolCalls[0].name).toBe('my_function');
        expect(result.toolCalls[0].arguments).toBe('{"key":');
      });

      it('appends to existing tool call arguments', () => {
        accumulator = {
          ...accumulator,
          toolCalls: [{ id: 'tool_123', name: 'my_function', type: 'function', arguments: '{"key":' }],
        };
        const event: StreamEvent = {
          type: 'response.function_call_arguments.delta',
          delta: '"value"}',
          item_id: 'tool_123',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].arguments).toBe('{"key":"value"}');
      });

      it('defaults name to "unknown" if not provided', () => {
        const event: StreamEvent = {
          type: 'response.function_call_arguments.delta',
          delta: '{}',
          item_id: 'tool_123',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].name).toBe('unknown');
      });

      it('returns same accumulator for empty delta when tool call exists (to avoid rerenders)', () => {
        accumulator = {
          ...accumulator,
          toolCalls: [{ id: 'tool_123', name: 'my_function', type: 'function', arguments: '{}' }],
        };
        const event: StreamEvent = {
          type: 'response.function_call_arguments.delta',
          delta: '',
          item_id: 'tool_123',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator); // Same reference
      });

      it('uses custom ID generator when item_id is missing', () => {
        const customGenerators: IdGenerators = {
          generateReasoningId: () => 'custom_reason_id',
          generateToolCallId: () => 'custom_tool_id',
        };
        const event: StreamEvent = {
          type: 'response.function_call_arguments.delta',
          delta: '{"key": "value"}',
          name: 'my_function',
        };
        const result = processStreamEvent(accumulator, event, customGenerators);
        expect(result.toolCalls[0].id).toBe('custom_tool_id');
      });
    });

    describe('response.completed', () => {
      it('extracts response ID and full response', () => {
        const event: StreamEvent = {
          type: 'response.completed',
          response: {
            id: 'resp_abc123',
            status: 'completed',
            output: [],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.responseId).toBe('resp_abc123');
        expect(result.responseJson).toEqual({
          id: 'resp_abc123',
          status: 'completed',
          output: [],
        });
      });

      it('handles missing response', () => {
        const event: StreamEvent = {
          type: 'response.completed',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.responseId).toBeNull();
        expect(result.responseJson).toBeNull();
      });

      it('handles non-string response ID', () => {
        const event: StreamEvent = {
          type: 'response.completed',
          response: {
            id: 12345,
            status: 'completed',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.responseId).toBeNull();
        expect(result.responseJson).toBeDefined();
      });
    });

    describe('response.incomplete', () => {
      it('extracts response ID and full response from incomplete response (truncated by max_output_tokens)', () => {
        const event: StreamEvent = {
          type: 'response.incomplete',
          response: {
            id: 'resp_truncated',
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [
              {
                type: 'message',
                status: 'incomplete',
                content: [{ type: 'output_text', text: 'Truncated content...' }],
              },
            ],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.responseId).toBe('resp_truncated');
        expect(result.responseJson).toBeDefined();
        expect(result.responseJson?.status).toBe('incomplete');
        expect(result.responseJson?.incomplete_details).toEqual({ reason: 'max_output_tokens' });
      });

      it('handles missing response in incomplete event', () => {
        const event: StreamEvent = {
          type: 'response.incomplete',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.responseId).toBeNull();
        expect(result.responseJson).toBeNull();
      });

      it('extracts citations from incomplete response', () => {
        const event: StreamEvent = {
          type: 'response.incomplete',
          response: {
            id: 'resp_partial',
            status: 'incomplete',
            incomplete_details: { reason: 'max_output_tokens' },
            output: [
              {
                type: 'message',
                content: [
                  {
                    type: 'output_text',
                    text: 'Content with citations',
                    annotations: [
                      {
                        type: 'url_citation',
                        url: 'https://example.com/article',
                        title: 'Example Article',
                        start_index: 0,
                        end_index: 10,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.citations).toHaveLength(1);
        expect(result.citations[0].url).toBe('https://example.com/article');
      });
    });

    describe('response.output_item events', () => {
      it('extracts reasoning from output_item.done with summary', () => {
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'rs_final',
            type: 'reasoning',
            summary: [
              { type: 'summary_text', text: 'First thought' },
              { type: 'summary_text', text: 'Second thought' },
            ],
          },
        };
        const result = processStreamEvent(accumulator, event);
        // Each summary text gets its own ID with index suffix (to match delta event IDs)
        expect(result.reasoning).toHaveLength(2);
        expect(result.reasoning[0].id).toBe('rs_final_0');
        expect(result.reasoning[0].content).toBe('First thought');
        expect(result.reasoning[1].id).toBe('rs_final_1');
        expect(result.reasoning[1].content).toBe('Second thought');
      });

      it('uses custom ID generator when item id is missing', () => {
        const customGenerators: IdGenerators = {
          generateReasoningId: () => 'custom_output_item_id',
          generateToolCallId: () => 'custom_tool_id',
        };
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            type: 'reasoning',
            summary: [
              { type: 'summary_text', text: 'Thought' },
            ],
          },
        };
        const result = processStreamEvent(accumulator, event, customGenerators);
        // ID includes index suffix even for single summary
        expect(result.reasoning[0].id).toBe('custom_output_item_id_0');
      });

      it('ignores non-reasoning output items', () => {
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'msg_123',
            type: 'message',
            content: [{ type: 'text', text: 'Hello' }],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.reasoning).toEqual([]);
      });

      it('creates a web_search_call tool call from output_item.added', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'ws_123',
            type: 'web_search_call',
            status: 'in_progress',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('ws_123');
        expect(result.toolCalls[0].type).toBe('web_search');
        expect(result.toolCalls[0].name).toBe('web_search');
        expect(result.toolCalls[0].status).toBe('in_progress');
      });

      it('updates web_search_call with query from output_item.done', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ws_123',
              name: 'web_search',
              type: 'web_search' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'ws_123',
            type: 'web_search_call',
            status: 'completed',
            action: { type: 'search', query: 'Paris overview' },
          },
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
        expect(result.toolCalls[0].query).toBe('Paris overview');
        expect(result.toolCalls[0].webSearchActionType).toBe('search');
      });

      it('handles open_page action type', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ws_open_123',
              name: 'web_search',
              type: 'web_search' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'ws_open_123',
            type: 'web_search_call',
            status: 'completed',
            action: { type: 'open_page' },
          },
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
        expect(result.toolCalls[0].webSearchActionType).toBe('open_page');
      });

      it('creates new web_search_call with open_page action from output_item.added', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'ws_new_open',
            type: 'web_search_call',
            status: 'in_progress',
            action: { type: 'open_page' },
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('ws_new_open');
        expect(result.toolCalls[0].type).toBe('web_search');
        expect(result.toolCalls[0].webSearchActionType).toBe('open_page');
        expect(result.toolCalls[0].status).toBe('in_progress');
      });
    });

    describe('web_search_call status events', () => {
      it('updates status to searching', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ws_123',
              name: 'web_search',
              type: 'web_search' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.web_search_call.searching',
          item_id: 'ws_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('searching');
      });

      it('updates status to completed', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ws_123',
              name: 'web_search',
              type: 'web_search' as const,
              arguments: '',
              status: 'searching' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.web_search_call.completed',
          item_id: 'ws_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
      });

      it('ignores status event for unknown item_id', () => {
        const event: StreamEvent = {
          type: 'response.web_search_call.searching',
          item_id: 'unknown_id',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });

      it('ignores status event without item_id', () => {
        const event: StreamEvent = {
          type: 'response.web_search_call.searching',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });
    });

    describe('code_interpreter_call events', () => {
      it('creates a code_interpreter_call from output_item.added', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'ci_123',
            type: 'code_interpreter_call',
            status: 'in_progress',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('ci_123');
        expect(result.toolCalls[0].type).toBe('code_interpreter');
        expect(result.toolCalls[0].name).toBe('code_interpreter');
        expect(result.toolCalls[0].status).toBe('in_progress');
      });

      it('updates code_interpreter_call with code and output from output_item.done', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_123',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'ci_123',
            type: 'code_interpreter_call',
            status: 'completed',
            code: 'print(2 + 2)',
            container_id: 'container_abc',
            outputs: [{ type: 'logs', logs: '4' }],
          },
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
        expect(result.toolCalls[0].code).toBe('print(2 + 2)');
        expect(result.toolCalls[0].containerId).toBe('container_abc');
        expect(result.toolCalls[0].output).toBe('4');
      });

      it('updates status to interpreting', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_123',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.interpreting',
          item_id: 'ci_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('interpreting');
      });

      it('updates status to completed', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_123',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.completed',
          item_id: 'ci_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
      });

      it('accumulates code from code.delta events', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_123',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'in_progress' as const,
              code: 'print(',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.code.delta',
          item_id: 'ci_123',
          delta: '2 + 2)',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].code).toBe('print(2 + 2)');
      });

      it('creates tool call entry from code.delta if not exists', () => {
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.code.delta',
          item_id: 'ci_new',
          delta: 'x = 1',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('ci_new');
        expect(result.toolCalls[0].code).toBe('x = 1');
        expect(result.toolCalls[0].type).toBe('code_interpreter');
      });

      it('captures output from output event', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_123',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
              code: 'print("hello")',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.output',
          item_id: 'ci_123',
          output: [
            { type: 'logs', logs: 'hello' },
          ],
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].output).toBe('hello');
      });

      it('captures images from output event', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_img',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
              code: 'import matplotlib; plt.plot([1,2,3])',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_outputs.done',
          item_id: 'ci_img',
          outputs: [
            { type: 'logs', logs: 'Plot created' },
            { type: 'image', url: 'https://example.com/chart.png' },
            { type: 'image', url: 'data:image/png;base64,iVBORw0KGgo=' },
          ],
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].output).toBe('Plot created');
        expect(result.toolCalls[0].codeInterpreterImages).toHaveLength(2);
        expect(result.toolCalls[0].codeInterpreterImages![0].url).toBe('https://example.com/chart.png');
        expect(result.toolCalls[0].codeInterpreterImages![1].url).toBe('data:image/png;base64,iVBORw0KGgo=');
      });

      it('extracts images from output_item.done with code_interpreter_call', () => {
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'ci_full',
            type: 'code_interpreter_call',
            status: 'completed',
            code: 'plt.savefig("chart.png")',
            outputs: [
              { type: 'logs', logs: 'Saved' },
              { type: 'image', url: 'https://example.com/generated.png' },
            ],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].codeInterpreterImages).toHaveLength(1);
        expect(result.toolCalls[0].codeInterpreterImages![0].url).toBe('https://example.com/generated.png');
        expect(result.toolCalls[0].output).toBe('Saved');
      });

      it('does not create codeInterpreterImages if no images in output', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_text_only',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
              code: 'print("text only")',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_outputs.done',
          item_id: 'ci_text_only',
          outputs: [
            { type: 'logs', logs: 'text only' },
          ],
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].output).toBe('text only');
        expect(result.toolCalls[0].codeInterpreterImages).toBeUndefined();
      });

      it('extracts files from output_item.done with code_interpreter_call', () => {
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'ci_files_done',
            type: 'code_interpreter_call',
            status: 'completed',
            code: 'df.to_csv("output.csv")',
            outputs: [
              { type: 'logs', logs: 'Saved!' },
              { type: 'file', url: 'https://example.com/output.csv', mime_type: 'text/csv', filename: 'output.csv' },
            ],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].codeInterpreterFiles).toHaveLength(1);
        expect(result.toolCalls[0].codeInterpreterFiles![0].url).toBe('https://example.com/output.csv');
        expect(result.toolCalls[0].codeInterpreterFiles![0].mimeType).toBe('text/csv');
        expect(result.toolCalls[0].codeInterpreterFiles![0].filename).toBe('output.csv');
        expect(result.toolCalls[0].output).toBe('Saved!');
      });

      it('captures files from code_interpreter_call_outputs.done event', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_file_out',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
              code: 'df.to_csv("data.csv")',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_outputs.done',
          item_id: 'ci_file_out',
          outputs: [
            { type: 'file', url: 'https://example.com/data.csv', mime_type: 'text/csv', filename: 'data.csv' },
          ],
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].codeInterpreterFiles).toHaveLength(1);
        expect(result.toolCalls[0].codeInterpreterFiles![0].url).toBe('https://example.com/data.csv');
        expect(result.toolCalls[0].codeInterpreterFiles![0].mimeType).toBe('text/csv');
        expect(result.toolCalls[0].codeInterpreterFiles![0].filename).toBe('data.csv');
      });

      it('extracts filename from URL when not explicitly provided', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_url_file',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_outputs.done',
          item_id: 'ci_url_file',
          outputs: [
            { type: 'file', url: 'https://example.com/downloads/report.xlsx' },
          ],
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].codeInterpreterFiles![0].filename).toBe('report.xlsx');
      });

      it('does not create codeInterpreterFiles if no files in output', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_no_files',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'interpreting' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_outputs.done',
          item_id: 'ci_no_files',
          outputs: [
            { type: 'logs', logs: 'only text' },
          ],
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].codeInterpreterFiles).toBeUndefined();
      });

      it('captures final complete code from code.done event', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_done',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'in_progress' as const,
              code: 'partial',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.code.done',
          item_id: 'ci_done',
          code: 'print("final complete code")',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].code).toBe('print("final complete code")');
      });

      it('creates tool call from code.done if not yet existing', () => {
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.code.done',
          item_id: 'ci_new_done',
          code: 'x = 42',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('ci_new_done');
        expect(result.toolCalls[0].code).toBe('x = 42');
        expect(result.toolCalls[0].type).toBe('code_interpreter');
      });

      it('handles code_interpreter_call_code.delta (underscore variant)', () => {
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_code.delta',
          item_id: 'ci_underscore',
          delta: 'print("underscore")',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('ci_underscore');
        expect(result.toolCalls[0].code).toBe('print("underscore")');
        expect(result.toolCalls[0].type).toBe('code_interpreter');
      });

      it('handles code_interpreter_call_code.done (underscore variant)', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_us_done',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'in_progress' as const,
              code: 'partial',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call_code.done',
          item_id: 'ci_us_done',
          code: 'x = "final"',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].code).toBe('x = "final"');
      });

      it('returns same accumulator for empty code delta when tool exists', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'ci_123',
              name: 'code_interpreter',
              type: 'code_interpreter' as const,
              arguments: '',
              status: 'in_progress' as const,
              code: 'existing',
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.code.delta',
          item_id: 'ci_123',
          delta: '',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result).toBe(initialAccumulator);
      });

      it('ignores status event for unknown item_id', () => {
        const event: StreamEvent = {
          type: 'response.code_interpreter_call.interpreting',
          item_id: 'unknown_id',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });
    });

    describe('file_search_call events', () => {
      it('creates a file_search_call from output_item.added', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'fs_123',
            type: 'file_search_call',
            status: 'in_progress',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('fs_123');
        expect(result.toolCalls[0].type).toBe('file_search');
        expect(result.toolCalls[0].name).toBe('file_search');
        expect(result.toolCalls[0].status).toBe('in_progress');
      });

      it('updates file_search_call with queries and results from output_item.done', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'fs_456',
              name: 'file_search',
              type: 'file_search' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'fs_456',
            type: 'file_search_call',
            status: 'completed',
            queries: ['what is Azure?'],
            results: [
              { file_id: 'file_1', filename: 'docs.pdf', score: 0.9, text: 'Azure is a cloud platform.' },
            ],
          },
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
        expect(result.toolCalls[0].query).toBe('what is Azure?');
        expect(result.toolCalls[0].fileSearchResults).toHaveLength(1);
        expect(result.toolCalls[0].fileSearchResults![0].filename).toBe('docs.pdf');
        expect(result.toolCalls[0].fileSearchResults![0].score).toBe(0.9);
      });

      it('creates file_search_call directly from output_item.done when not yet existing', () => {
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'fs_new',
            type: 'file_search_call',
            status: 'completed',
            queries: ['azure functions'],
            results: [],
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('fs_new');
        expect(result.toolCalls[0].type).toBe('file_search');
        expect(result.toolCalls[0].status).toBe('completed');
      });

      it('updates status to searching', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'fs_123',
              name: 'file_search',
              type: 'file_search' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.file_search_call.searching',
          item_id: 'fs_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('searching');
      });

      it('updates status to completed', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'fs_123',
              name: 'file_search',
              type: 'file_search' as const,
              arguments: '',
              status: 'searching' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.file_search_call.completed',
          item_id: 'fs_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
      });

      it('ignores file_search_call status event for unknown item_id', () => {
        const event: StreamEvent = {
          type: 'response.file_search_call.searching',
          item_id: 'unknown_id',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });
    });

    describe('mcp_call_arguments events', () => {
      it('accumulates MCP call arguments from delta events', () => {
        // First, add an MCP call
        accumulator = {
          ...accumulator,
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mslearn/microsoft_docs_search',
              type: 'mcp' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.delta',
          item_id: 'mcp_123',
          delta: '{"query":"What is Azure"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].arguments).toBe('{"query":"What is Azure"}');
      });

      it('appends to existing MCP arguments', () => {
        accumulator = {
          ...accumulator,
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mslearn/microsoft_docs_search',
              type: 'mcp' as const,
              arguments: '{"query":',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.delta',
          item_id: 'mcp_123',
          delta: '"Azure"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].arguments).toBe('{"query":"Azure"}');
      });

      it('creates new tool call if delta arrives before output_item.added', () => {
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.delta',
          item_id: 'mcp_new',
          delta: '{"test":"value"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('mcp_new');
        expect(result.toolCalls[0].type).toBe('mcp');
        expect(result.toolCalls[0].arguments).toBe('{"test":"value"}');
      });

      it('returns same accumulator for empty delta when tool exists', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mslearn/tool',
              type: 'mcp' as const,
              arguments: 'existing',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.delta',
          item_id: 'mcp_123',
          delta: '',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result).toBe(initialAccumulator);
      });

      it('sets final arguments from arguments.done event', () => {
        accumulator = {
          ...accumulator,
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mslearn/microsoft_docs_search',
              type: 'mcp' as const,
              arguments: '{"query":"partial',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.done',
          item_id: 'mcp_123',
          arguments: '{"query":"Azure overview"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].arguments).toBe('{"query":"Azure overview"}');
      });

      it('creates tool call from arguments.done if it does not exist', () => {
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.done',
          item_id: 'mcp_new',
          arguments: '{"query":"test"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('mcp_new');
        expect(result.toolCalls[0].type).toBe('mcp');
        expect(result.toolCalls[0].arguments).toBe('{"query":"test"}');
      });

      it('ignores delta event without item_id', () => {
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.delta',
          delta: '{"test":"value"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });

      it('ignores done event without item_id', () => {
        const event: StreamEvent = {
          type: 'response.mcp_call_arguments.done',
          arguments: '{"test":"value"}',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });
    });

    describe('mcp_call output item events', () => {
      it('creates mcp_call from output_item.added', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'mcp_123',
            type: 'mcp_call',
            status: 'in_progress',
            name: 'microsoft_docs_search',
            server_label: 'mslearn',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        expect(result.toolCalls[0].id).toBe('mcp_123');
        expect(result.toolCalls[0].type).toBe('mcp');
        expect(result.toolCalls[0].name).toBe('mslearn/microsoft_docs_search');
        expect(result.toolCalls[0].status).toBe('in_progress');
      });

      it('updates existing mcp_call name from placeholder when output_item.done arrives', () => {
        // Simulate scenario where delta event created placeholder entry first
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mcp_tool', // Placeholder name
              type: 'mcp' as const,
              arguments: '{"query":"Azure"}',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'mcp_123',
            type: 'mcp_call',
            status: 'completed',
            name: 'microsoft_docs_search',
            server_label: 'mslearn',
            arguments: '{"query":"Azure overview"}',
            output: 'Some search results...',
          },
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].name).toBe('mslearn/microsoft_docs_search');
        expect(result.toolCalls[0].type).toBe('mcp');
        expect(result.toolCalls[0].status).toBe('completed');
        expect(result.toolCalls[0].arguments).toBe('{"query":"Azure overview"}');
        expect(result.toolCalls[0].result).toBe('Some search results...');
      });

      it('handles mcp_call with error', () => {
        const event: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'mcp_err',
            type: 'mcp_call',
            status: 'completed',
            name: 'failing_tool',
            server_label: 'test',
            error: 'Connection failed',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].result).toBe('Error: Connection failed');
      });

      it('creates mcp_call without server_label', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'mcp_no_label',
            type: 'mcp_call',
            status: 'in_progress',
            name: 'some_tool',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls[0].name).toBe('some_tool');
      });

      it('uses custom ID generator when item id is missing', () => {
        const customGenerators: IdGenerators = {
          generateReasoningId: () => 'custom_reason_id',
          generateToolCallId: () => 'custom_mcp_id',
        };
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            type: 'mcp_call',
            status: 'in_progress',
            name: 'tool',
            server_label: 'server',
          },
        };
        const result = processStreamEvent(accumulator, event, customGenerators);
        expect(result.toolCalls[0].id).toBe('custom_mcp_id');
      });
    });

    describe('mcp_call status events', () => {
      it('updates status to in_progress', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mslearn/tool',
              type: 'mcp' as const,
              arguments: '',
              status: undefined,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.mcp_call.in_progress',
          item_id: 'mcp_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('in_progress');
      });

      it('updates status to completed', () => {
        const initialAccumulator = {
          ...createInitialAccumulator(),
          toolCalls: [
            {
              id: 'mcp_123',
              name: 'mslearn/tool',
              type: 'mcp' as const,
              arguments: '',
              status: 'in_progress' as const,
            },
          ],
        };
        const event: StreamEvent = {
          type: 'response.mcp_call.completed',
          item_id: 'mcp_123',
        };
        const result = processStreamEvent(initialAccumulator, event);
        expect(result.toolCalls[0].status).toBe('completed');
      });

      it('ignores status event for unknown item_id', () => {
        const event: StreamEvent = {
          type: 'response.mcp_call.completed',
          item_id: 'unknown_id',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });

      it('ignores status event without item_id', () => {
        const event: StreamEvent = {
          type: 'response.mcp_call.in_progress',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });
    });

    describe('mcp_approval_request events', () => {
      it('creates mcp_approval tool call from output_item.added with mcp_approval_request', () => {
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'mcpr_abc123',
            type: 'mcp_approval_request',
            name: 'microsoft_docs_search',
            server_label: 'mslearn',
            arguments: '{"query": "Azure AI Foundry"}',
          },
        };
        const result = processStreamEvent(accumulator, event);
        expect(result.toolCalls).toHaveLength(1);
        // The tool call ID should match the item ID (consistent with other tool call handlers)
        expect(result.toolCalls[0].id).toBe('mcpr_abc123');
        expect(result.toolCalls[0].type).toBe('mcp_approval');
        expect(result.toolCalls[0].name).toBe('mslearn/microsoft_docs_search');
        expect(result.toolCalls[0].status).toBe('pending_approval');
        expect(result.toolCalls[0].serverLabel).toBe('mslearn');
        // approvalRequestId is the same as the tool call ID
        expect(result.toolCalls[0].approvalRequestId).toBe('mcpr_abc123');
        expect(result.toolCalls[0].arguments).toBe('{"query": "Azure AI Foundry"}');
      });

      it('creates mcp_approval without server_label', () => {
        const customGenerators: IdGenerators = {
          generateReasoningId: () => 'test_reasoning_id',
          generateToolCallId: () => 'test_tool_id',
        };
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'mcpr_xyz789',
            type: 'mcp_approval_request',
            name: 'some_tool',
            arguments: '{}',
          },
        };
        const result = processStreamEvent(accumulator, event, customGenerators);
        expect(result.toolCalls[0].name).toBe('some_tool');
        expect(result.toolCalls[0].serverLabel).toBeUndefined();
      });

      it('handles mcp_approval_request with empty arguments', () => {
        const customGenerators: IdGenerators = {
          generateReasoningId: () => 'test_reasoning_id',
          generateToolCallId: () => 'test_tool_id',
        };
        const event: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'mcpr_empty',
            type: 'mcp_approval_request',
            name: 'no_args_tool',
            server_label: 'test_server',
          },
        };
        const result = processStreamEvent(accumulator, event, customGenerators);
        expect(result.toolCalls[0].arguments).toBe('');
      });

      it('deduplicates mcp_approval_request when both added and done events fire', () => {
        // Simulates real API behavior where both response.output_item.added and
        // response.output_item.done fire for the same mcp_approval_request
        const addedEvent: StreamEvent = {
          type: 'response.output_item.added',
          item: {
            id: 'mcpr_dedup_test',
            type: 'mcp_approval_request',
            name: 'microsoft_docs_search',
            server_label: 'mslearn',
            arguments: '{"query": "test"}',
          },
        };
        const doneEvent: StreamEvent = {
          type: 'response.output_item.done',
          item: {
            id: 'mcpr_dedup_test',
            type: 'mcp_approval_request',
            name: 'microsoft_docs_search',
            server_label: 'mslearn',
            arguments: '{"query": "test"}',
          },
        };

        // Process added event first
        const afterAdded = processStreamEvent(accumulator, addedEvent);
        expect(afterAdded.toolCalls).toHaveLength(1);
        expect(afterAdded.toolCalls[0].id).toBe('mcpr_dedup_test');

        // Process done event - should NOT create a duplicate
        const afterDone = processStreamEvent(afterAdded, doneEvent);
        expect(afterDone.toolCalls).toHaveLength(1);
        expect(afterDone.toolCalls[0].id).toBe('mcpr_dedup_test');
        // Should return same accumulator reference since nothing changed
        expect(afterDone).toBe(afterAdded);
      });
    });

    describe('unknown event types', () => {
      it('returns accumulator unchanged for unknown events', () => {
        const event: StreamEvent = {
          type: 'response.unknown.event',
          data: 'something',
        };
        const result = processStreamEvent(accumulator, event);
        expect(result).toBe(accumulator);
      });
    });

    describe('injectable ID generators', () => {
      it('exports defaultIdGenerators', () => {
        expect(defaultIdGenerators).toBeDefined();
        expect(typeof defaultIdGenerators.generateReasoningId).toBe('function');
        expect(typeof defaultIdGenerators.generateToolCallId).toBe('function');
      });

      it('uses custom ID generators for deterministic testing', () => {
        let reasoningCounter = 0;
        let toolCallCounter = 0;
        const deterministicGenerators: IdGenerators = {
          generateReasoningId: () => `test_reason_${++reasoningCounter}`,
          generateToolCallId: () => `test_tool_${++toolCallCounter}`,
        };

        // Test reasoning ID generation
        const reasoningEvent: StreamEvent = {
          type: 'response.reasoning_summary_text.delta',
          delta: 'Thinking',
          summary_index: 0,
        };
        const reasoningResult = processStreamEvent(accumulator, reasoningEvent, deterministicGenerators);
        expect(reasoningResult.reasoning[0].id).toBe('test_reason_1_0');

        // Test tool call ID generation (counter is separate, so starts at 1)
        const toolEvent: StreamEvent = {
          type: 'response.function_call_arguments.delta',
          delta: '{}',
          name: 'test_fn',
        };
        const toolResult = processStreamEvent(accumulator, toolEvent, deterministicGenerators);
        expect(toolResult.toolCalls[0].id).toBe('test_tool_1');
      });
    });
  });

  describe('processStream', () => {
    it('processes all events from an async iterable', async () => {
      async function* createEvents(): AsyncGenerator<StreamEvent> {
        yield { type: 'response.output_text.delta', delta: 'Hello ' };
        yield { type: 'response.output_text.delta', delta: 'world!' };
        yield { type: 'response.completed', response: { id: 'resp_123' } };
      }

      const result = await processStream(createEvents());
      expect(result.content).toBe('Hello world!');
      expect(result.responseId).toBe('resp_123');
    });

    it('processes all events from a sync iterable', async () => {
      const events: StreamEvent[] = [
        { type: 'response.output_text.delta', delta: 'Test ' },
        { type: 'response.output_text.delta', delta: 'message' },
      ];

      const result = await processStream(events);
      expect(result.content).toBe('Test message');
    });

    it('uses provided initial accumulator', async () => {
      const events: StreamEvent[] = [
        { type: 'response.output_text.delta', delta: 'more text' },
      ];

      const initial: StreamAccumulator = {
        content: 'Starting with ',
        reasoning: [],
        toolCalls: [],
        citations: [],
        fileCitations: [],
        containerFileCitations: [],
        responseId: null,
        responseJson: null,
        isTruncated: false,
        truncationReason: null,
      };

      const result = await processStream(events, initial);
      expect(result.content).toBe('Starting with more text');
    });
  });

  describe('extractCitationsFromResponse', () => {
    it('extracts citations from response with url_citation annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Some content with citations',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com/article',
                    title: 'Example Article',
                    start_index: 0,
                    end_index: 10,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0]).toEqual({
        url: 'https://example.com/article',
        title: 'Example Article',
        startIndex: 0,
        endIndex: 10,
      });
    });

    it('extracts multiple citations from multiple content items', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'First part',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com/1',
                    title: 'Article 1',
                    start_index: 0,
                    end_index: 5,
                  },
                ],
              },
              {
                type: 'output_text',
                text: 'Second part',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com/2',
                    title: 'Article 2',
                    start_index: 10,
                    end_index: 15,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.citations).toHaveLength(2);
      expect(result.citations[0].url).toBe('https://example.com/1');
      expect(result.citations[1].url).toBe('https://example.com/2');
    });

    it('deduplicates citations by URL', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Content',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com/same',
                    title: 'Same Article',
                    start_index: 0,
                    end_index: 5,
                  },
                  {
                    type: 'url_citation',
                    url: 'https://example.com/same',
                    title: 'Same Article Again',
                    start_index: 10,
                    end_index: 15,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].url).toBe('https://example.com/same');
    });

    it('returns empty arrays when response has no output', () => {
      const response = { id: 'resp_123' };
      const result = extractCitationsFromResponse(response);
      expect(result.citations).toEqual([]);
      expect(result.fileCitations).toEqual([]);
    });

    it('returns empty arrays when output has no message items', () => {
      const response = {
        id: 'resp_123',
        output: [
          { type: 'web_search_call', action: { type: 'search', query: 'test' } },
        ],
      };
      const result = extractCitationsFromResponse(response);
      expect(result.citations).toEqual([]);
      expect(result.fileCitations).toEqual([]);
    });

    it('returns empty arrays when message has no annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'No citations here',
              },
            ],
          },
        ],
      };
      const result = extractCitationsFromResponse(response);
      expect(result.citations).toEqual([]);
      expect(result.fileCitations).toEqual([]);
    });

    it('ignores non-url_citation annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Content',
                annotations: [
                  {
                    type: 'some_other_annotation',
                    data: 'test',
                  },
                  {
                    type: 'url_citation',
                    url: 'https://example.com/valid',
                    title: 'Valid',
                    start_index: 0,
                    end_index: 5,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].url).toBe('https://example.com/valid');
    });

    it('skips malformed annotations with missing fields', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Content',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com/valid',
                    title: 'Valid',
                    start_index: 0,
                    end_index: 5,
                  },
                  {
                    type: 'url_citation',
                    url: 'https://example.com/no-title',
                    // missing title, start_index, end_index
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.citations).toHaveLength(1);
      expect(result.citations[0].url).toBe('https://example.com/valid');
    });

    it('extracts file_citation annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Content with file citations',
                annotations: [
                  {
                    type: 'file_citation',
                    file_id: 'file_123',
                    filename: 'document.pdf',
                    index: 42,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.fileCitations).toHaveLength(1);
      expect(result.fileCitations[0]).toEqual({
        fileId: 'file_123',
        filename: 'document.pdf',
        index: 42,
      });
    });

    it('deduplicates file citations by fileId', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Content',
                annotations: [
                  {
                    type: 'file_citation',
                    file_id: 'file_same',
                    filename: 'document.pdf',
                    index: 10,
                  },
                  {
                    type: 'file_citation',
                    file_id: 'file_same',
                    filename: 'document.pdf',
                    index: 50,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.fileCitations).toHaveLength(1);
      expect(result.fileCitations[0].fileId).toBe('file_same');
    });

    it('extracts both url_citation and file_citation annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Mixed citations',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://example.com',
                    title: 'Web Source',
                    start_index: 0,
                    end_index: 10,
                  },
                  {
                    type: 'file_citation',
                    file_id: 'file_123',
                    filename: 'uploaded.pdf',
                    index: 20,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.citations).toHaveLength(1);
      expect(result.fileCitations).toHaveLength(1);
      expect(result.citations[0].url).toBe('https://example.com');
      expect(result.fileCitations[0].fileId).toBe('file_123');
    });

    it('extracts container_file_citation annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Here is the data [output.csv]',
                annotations: [
                  {
                    type: 'container_file_citation',
                    container_id: 'container_abc',
                    file_id: 'file_xyz',
                    filename: 'output.csv',
                    start_index: 18,
                    end_index: 29,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.containerFileCitations).toHaveLength(1);
      expect(result.containerFileCitations[0]).toEqual({
        containerId: 'container_abc',
        fileId: 'file_xyz',
        filename: 'output.csv',
        startIndex: 18,
        endIndex: 29,
      });
    });

    it('deduplicates container file citations by fileId', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'text',
                annotations: [
                  { type: 'container_file_citation', container_id: 'c1', file_id: 'f_same', filename: 'a.csv', start_index: 0, end_index: 5 },
                  { type: 'container_file_citation', container_id: 'c1', file_id: 'f_same', filename: 'a.csv', start_index: 10, end_index: 15 },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.containerFileCitations).toHaveLength(1);
      expect(result.containerFileCitations[0].fileId).toBe('f_same');
    });

    it('filters out container_file_citations where startIndex === endIndex (inline image placeholders)', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'text',
                annotations: [
                  // Inline image placeholder (0-0) - should be filtered out
                  { type: 'container_file_citation', container_id: 'c1', file_id: 'f_img', filename: 'chart.png', start_index: 0, end_index: 0 },
                  // Real file reference - should be kept
                  { type: 'container_file_citation', container_id: 'c1', file_id: 'f_csv', filename: 'data.csv', start_index: 5, end_index: 15 },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.containerFileCitations).toHaveLength(1);
      expect(result.containerFileCitations[0].fileId).toBe('f_csv');
    });

    it('returns empty containerFileCitations when no container_file_citation annotations', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'No container citations here',
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.containerFileCitations).toEqual([]);
    });

    it('skips malformed container_file_citation annotations with missing fields', () => {
      const response = {
        id: 'resp_123',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: 'Content',
                annotations: [
                  {
                    type: 'container_file_citation',
                    container_id: 'c1',
                    file_id: 'f1',
                    filename: 'valid.csv',
                    start_index: 0,
                    end_index: 10,
                  },
                  {
                    type: 'container_file_citation',
                    container_id: 'c2',
                    // missing file_id, filename, start_index, end_index
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = extractCitationsFromResponse(response);
      expect(result.containerFileCitations).toHaveLength(1);
      expect(result.containerFileCitations[0].fileId).toBe('f1');
    });

    it('propagates containerFileCitations through response.completed event', () => {
      const event: StreamEvent = {
        type: 'response.completed',
        response: {
          id: 'resp_with_container',
          status: 'completed',
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'See [result.csv]',
                  annotations: [
                    {
                      type: 'container_file_citation',
                      container_id: 'cont_123',
                      file_id: 'file_result',
                      filename: 'result.csv',
                      start_index: 4,
                      end_index: 16,
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const acc = createInitialAccumulator();
      const result = processStreamEvent(acc, event);
      expect(result.containerFileCitations).toHaveLength(1);
      expect(result.containerFileCitations[0].containerId).toBe('cont_123');
      expect(result.containerFileCitations[0].filename).toBe('result.csv');
    });
  });
});
