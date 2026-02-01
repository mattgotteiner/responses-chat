/**
 * Utility functions for token usage calculations
 */

import type { Message, TokenUsage } from '../types';
import { extractTokenUsage } from '../types';

/**
 * Aggregates token usage across all messages in a conversation
 * @param messages - Array of messages to aggregate usage from
 * @returns Aggregated TokenUsage object with totals, or undefined if no usage data exists
 */
export function calculateConversationUsage(
  messages: Message[]
): TokenUsage | undefined {
  let hasUsage = false;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let totalReasoning = 0;

  for (const message of messages) {
    if (message.role !== 'assistant' || !message.responseJson) {
      continue;
    }

    const usage = extractTokenUsage(message.responseJson);
    if (!usage) {
      continue;
    }

    hasUsage = true;
    totalInput += usage.input_tokens;
    totalOutput += usage.output_tokens;
    totalCached += usage.input_tokens_details?.cached_tokens ?? 0;
    totalReasoning += usage.output_tokens_details?.reasoning_tokens ?? 0;
  }

  if (!hasUsage) {
    return undefined;
  }

  return {
    input_tokens: totalInput,
    output_tokens: totalOutput,
    total_tokens: totalInput + totalOutput,
    input_tokens_details: totalCached > 0 ? { cached_tokens: totalCached } : undefined,
    output_tokens_details: totalReasoning > 0 ? { reasoning_tokens: totalReasoning } : undefined,
  };
}
