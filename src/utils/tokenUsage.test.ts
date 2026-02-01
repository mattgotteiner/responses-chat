import { describe, it, expect } from 'vitest';
import { calculateConversationUsage } from './tokenUsage';
import type { Message } from '../types';

function createMessage(
  role: 'user' | 'assistant',
  responseJson?: Record<string, unknown>
): Message {
  return {
    id: Math.random().toString(),
    role,
    content: 'test',
    timestamp: new Date(),
    responseJson,
  };
}

describe('calculateConversationUsage', () => {
  it('returns undefined for empty messages array', () => {
    expect(calculateConversationUsage([])).toBeUndefined();
  });

  it('returns undefined when no messages have usage data', () => {
    const messages = [
      createMessage('user'),
      createMessage('assistant', { some: 'data' }),
    ];

    expect(calculateConversationUsage(messages)).toBeUndefined();
  });

  it('calculates usage from a single assistant message', () => {
    const messages = [
      createMessage('user'),
      createMessage('assistant', {
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      }),
    ];

    const result = calculateConversationUsage(messages);

    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 200,
      total_tokens: 300,
      input_tokens_details: undefined,
      output_tokens_details: undefined,
    });
  });

  it('sums usage across multiple assistant messages', () => {
    const messages = [
      createMessage('user'),
      createMessage('assistant', {
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      }),
      createMessage('user'),
      createMessage('assistant', {
        usage: {
          input_tokens: 150,
          output_tokens: 250,
          total_tokens: 400,
        },
      }),
    ];

    const result = calculateConversationUsage(messages);

    expect(result).toEqual({
      input_tokens: 250,
      output_tokens: 450,
      total_tokens: 700,
      input_tokens_details: undefined,
      output_tokens_details: undefined,
    });
  });

  it('aggregates token details', () => {
    const messages = [
      createMessage('assistant', {
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 25 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 100 },
          total_tokens: 300,
        },
      }),
      createMessage('assistant', {
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 50 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 150 },
          total_tokens: 300,
        },
      }),
    ];

    const result = calculateConversationUsage(messages);

    expect(result?.input_tokens_details?.cached_tokens).toBe(75);
    expect(result?.output_tokens_details?.reasoning_tokens).toBe(250);
  });

  it('ignores user messages', () => {
    const messages = [
      createMessage('user', {
        usage: { input_tokens: 999, output_tokens: 999, total_tokens: 999 },
      }),
      createMessage('assistant', {
        usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
      }),
    ];

    const result = calculateConversationUsage(messages);

    expect(result?.total_tokens).toBe(300);
  });

  it('skips messages with invalid usage data', () => {
    const messages = [
      createMessage('assistant', {
        usage: { input_tokens: 'bad', output_tokens: 200, total_tokens: 300 },
      }),
      createMessage('assistant', {
        usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
      }),
    ];

    const result = calculateConversationUsage(messages);

    expect(result?.total_tokens).toBe(300);
  });

  it('omits token details when all values are zero', () => {
    const messages = [
      createMessage('assistant', {
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 300,
        },
      }),
    ];

    const result = calculateConversationUsage(messages);

    expect(result?.input_tokens_details).toBeUndefined();
    expect(result?.output_tokens_details).toBeUndefined();
  });
});
