/**
 * Utility for auto-generating thread titles using a smaller model
 */

import type OpenAI from 'openai';

const TITLE_PROMPT =
  'Generate a concise 3-6 word title for this conversation. Reply with ONLY the title, no quotes or punctuation.';

/**
 * Generate a short title for a conversation thread
 * @param client - OpenAI client configured for Azure
 * @param deployment - Model deployment name for title generation
 * @param userMessage - The first user message
 * @param assistantMessage - The first assistant response
 * @returns Generated title string
 */
export async function generateThreadTitle(
  client: OpenAI,
  deployment: string,
  userMessage: string,
  assistantMessage: string
): Promise<string> {
  // Truncate long messages to save tokens
  const maxLen = 500;
  const truncatedUser = userMessage.length > maxLen ? userMessage.slice(0, maxLen) + '...' : userMessage;
  const truncatedAssistant = assistantMessage.length > maxLen ? assistantMessage.slice(0, maxLen) + '...' : assistantMessage;

  const input = `User: ${truncatedUser}\n\nAssistant: ${truncatedAssistant}`;

  const response = await client.responses.create({
    model: deployment,
    instructions: TITLE_PROMPT,
    input,
    reasoning: { effort: 'minimal' },
  } as Parameters<typeof client.responses.create>[0]);

  // Extract text from the response
  const raw = response as unknown as Record<string, unknown>;
  const output = raw.output as Array<Record<string, unknown>> | undefined;
  if (output) {
    for (const item of output) {
      if (item.type === 'message') {
        const content = item.content as Array<Record<string, unknown>> | undefined;
        if (content) {
          for (const part of content) {
            if (part.type === 'output_text' && typeof part.text === 'string') {
              return part.text.trim().replace(/^["']|["']$/g, '');
            }
          }
        }
      }
    }
  }

  // Fallback: use first few words of user message
  const words = userMessage.split(/\s+/).slice(0, 5).join(' ');
  return words.length > 30 ? words.slice(0, 30) + '...' : words;
}
