import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialAccumulator,
  processStreamEvent,
  processStream,
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
          toolCalls: [{ id: 'tool_123', name: 'my_function', arguments: '{"key":' }],
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
          toolCalls: [{ id: 'tool_123', name: 'my_function', arguments: '{}' }],
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
        expect(result.reasoning).toHaveLength(1);
        expect(result.reasoning[0].id).toBe('rs_final');
        expect(result.reasoning[0].content).toBe('First thought\nSecond thought');
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
        expect(result.reasoning[0].id).toBe('custom_output_item_id');
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
        responseId: null,
        responseJson: null,
      };

      const result = await processStream(events, initial);
      expect(result.content).toBe('Starting with more text');
    });
  });
});
