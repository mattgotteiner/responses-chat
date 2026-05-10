import type { Message } from '../types';

/**
 * Serialize messages for storage/export: Date -> ISO string.
 * Streaming messages are sanitized so imported or reloaded threads never resume
 * in a broken mid-stream state.
 */
export function serializeMessages(messages: Message[]): unknown[] {
  return messages.map((message) => ({
    ...message,
    timestamp: message.timestamp instanceof Date
      ? message.timestamp.toISOString()
      : message.timestamp,
    ...(message.isStreaming && { isStreaming: false, isStopped: true }),
  }));
}

/** Deserialize messages from storage/export: ISO string -> Date. */
export function deserializeMessages(raw: unknown[]): Message[] {
  return (raw as Array<Record<string, unknown>>).map((message) => ({
    ...message,
    timestamp: new Date(message.timestamp as string),
  })) as Message[];
}
