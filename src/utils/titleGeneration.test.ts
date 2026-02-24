/**
 * Tests for thread title generation utility
 */

import { describe, it, expect, vi } from 'vitest';
import { generateThreadTitle } from './titleGeneration';

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
});
