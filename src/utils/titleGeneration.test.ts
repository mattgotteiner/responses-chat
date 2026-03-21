/**
 * Tests for thread title generation utility
 */

import { describe, it, expect, vi } from 'vitest';
import { generateThreadTitle, getLowestEffort } from './titleGeneration';

describe('generateThreadTitle', () => {
  it('extracts title from API response', async () => {
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: 'Discussing React Hooks',
                },
              ],
            },
          ],
        }),
      },
    };

    const title = await generateThreadTitle(
      mockClient as never,
      'gpt-5-nano',
      'How do React hooks work?',
      'React hooks are functions that let you use state and lifecycle features...'
    );

    expect(title).toBe('Discussing React Hooks');
    expect(mockClient.responses.create).toHaveBeenCalledOnce();
  });

  it('strips quotes from title', async () => {
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              content: [
                {
                  type: 'output_text',
                  text: '"React Hooks Overview"',
                },
              ],
            },
          ],
        }),
      },
    };

    const title = await generateThreadTitle(
      mockClient as never,
      'gpt-5-nano',
      'How do React hooks work?',
      'React hooks are...'
    );

    expect(title).toBe('React Hooks Overview');
  });

  it('falls back to user message words when API returns no output', async () => {
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const title = await generateThreadTitle(
      mockClient as never,
      'gpt-5-nano',
      'How do React hooks work today?',
      'Some response'
    );

    expect(title).toBe('How do React hooks work');
  });

  it('truncates long messages before sending', async () => {
    const longMessage = 'a'.repeat(1000);
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Long Message Chat' }],
            },
          ],
        }),
      },
    };

    await generateThreadTitle(mockClient as never, 'gpt-5-nano', longMessage, longMessage);

    const callArgs = mockClient.responses.create.mock.calls[0][0] as Record<string, unknown>;
    const input = callArgs.input as string;
    // Should contain truncated versions
    expect(input).toContain('...');
  });

  it('uses the lowest available effort for the model', async () => {
    // Regression: "minimal" effort is only supported by gpt-5+. Using it silently
    // broke title generation for gpt-5-nano / gpt-5-mini users.
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Test Title' }],
            },
          ],
        }),
      },
    };

    await generateThreadTitle(mockClient as never, 'gpt-5-mini', 'Hello', 'Hi there');

    const callArgs = mockClient.responses.create.mock.calls[0][0] as Record<string, unknown>;
    const reasoning = callArgs.reasoning as { effort: string };
    // gpt-5-mini supports ['low', 'medium', 'high'] — lowest is 'low'
    expect(reasoning.effort).toBe('low');
  });

  it('uses none when the model supports non-reasoning mode', async () => {
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Test Title' }],
            },
          ],
        }),
      },
    };

    await generateThreadTitle(mockClient as never, 'gpt-5.4-mini', 'Hello', 'Hi there');

    const callArgs = mockClient.responses.create.mock.calls[0][0] as Record<string, unknown>;
    const reasoning = callArgs.reasoning as { effort: string };
    expect(reasoning.effort).toBe('none');
  });

  it('picks minimal effort for models that support it', async () => {
    const mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: 'Test Title' }],
            },
          ],
        }),
      },
    };

    await generateThreadTitle(mockClient as never, 'gpt-5', 'Hello', 'Hi there');

    const callArgs = mockClient.responses.create.mock.calls[0][0] as Record<string, unknown>;
    const reasoning = callArgs.reasoning as { effort: string };
    // gpt-5 supports ['low', 'medium', 'high', 'minimal'] — lowest is 'minimal'
    expect(reasoning.effort).toBe('minimal');
  });
});

describe('getLowestEffort', () => {
  it('returns low for gpt-5-mini (no minimal/none support)', () => {
    expect(getLowestEffort('gpt-5-mini')).toBe('low');
  });

  it('returns none for gpt-5.4-mini', () => {
    expect(getLowestEffort('gpt-5.4-mini')).toBe('none');
  });

  it('returns minimal for gpt-5', () => {
    expect(getLowestEffort('gpt-5')).toBe('minimal');
  });

  it('returns none for gpt-5.1', () => {
    expect(getLowestEffort('gpt-5.1')).toBe('none');
  });

  it('returns low for unknown models (default efforts)', () => {
    expect(getLowestEffort('some-custom-model')).toBe('low');
  });
});
