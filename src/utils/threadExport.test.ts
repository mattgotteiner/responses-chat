import { describe, expect, it } from 'vitest';
import type { Thread } from '../types';
import {
  createThreadsExportPayload,
  mergeImportedThreads,
  parseThreadsExport,
  stringifyThreadsExport,
} from './threadExport';

function makeThread(id: string, updatedAt: number, title = 'Test thread'): Thread {
  return {
    id,
    title,
    createdAt: updatedAt - 1000,
    updatedAt,
    previousResponseId: null,
    uploadedFileIds: [],
    messages: [
      {
        id: `${id}_message`,
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2026-05-10T12:00:00.000Z'),
      },
    ],
  };
}

describe('thread export utilities', () => {
  it('creates a versioned threads-only export payload', () => {
    const payload = createThreadsExportPayload([makeThread('thread_1', 2000)]);

    expect(payload.format).toBe('responses-chat-threads');
    expect(payload.version).toBe(1);
    expect(payload.threads).toHaveLength(1);
    expect(payload.threads[0].id).toBe('thread_1');
    expect(payload.threads[0].messages[0]).toMatchObject({
      id: 'thread_1_message',
      timestamp: '2026-05-10T12:00:00.000Z',
    });
    expect(payload).not.toHaveProperty('settings');
  });

  it('round-trips exported threads with Date message timestamps', () => {
    const thread = makeThread('thread_1', 2000);
    const parsed = parseThreadsExport(stringifyThreadsExport([thread]));

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(thread.id);
    expect(parsed[0].messages[0].timestamp).toBeInstanceOf(Date);
    expect(parsed[0].messages[0].timestamp.toISOString()).toBe('2026-05-10T12:00:00.000Z');
  });

  it('sanitizes streaming messages in export payloads', () => {
    const thread = makeThread('thread_1', 2000);
    thread.messages.push({
      id: 'assistant_1',
      role: 'assistant',
      content: 'Partial',
      timestamp: new Date('2026-05-10T12:01:00.000Z'),
      isStreaming: true,
    });

    const parsed = parseThreadsExport(stringifyThreadsExport([thread]));
    const assistant = parsed[0].messages.find((message) => message.id === 'assistant_1');

    expect(assistant).toMatchObject({ isStreaming: false, isStopped: true });
  });

  it('rejects unsupported export formats', () => {
    expect(() => parseThreadsExport('{"format":"other","version":1,"threads":[]}'))
      .toThrow('unsupported format or version');
  });

  it('rejects duplicate thread IDs', () => {
    const thread = makeThread('thread_1', 2000);
    const payload = createThreadsExportPayload([thread, thread]);

    expect(() => parseThreadsExport(JSON.stringify(payload))).toThrow('duplicate thread id');
  });

  it('merges new threads and replaces older local copies', () => {
    const existing = [makeThread('thread_1', 1000), makeThread('thread_2', 3000)];
    const imported = [
      makeThread('thread_1', 2000, 'Newer title'),
      makeThread('thread_2', 2500, 'Older skipped title'),
      makeThread('thread_3', 4000),
    ];

    const result = mergeImportedThreads(existing, imported);

    expect(result.imported).toBe(1);
    expect(result.replaced).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.changedThreadIds).toEqual(['thread_1', 'thread_3']);
    expect(result.threads.map((thread) => thread.id)).toEqual(['thread_3', 'thread_2', 'thread_1']);
    expect(result.threads.find((thread) => thread.id === 'thread_1')?.title).toBe('Newer title');
    expect(result.threads.find((thread) => thread.id === 'thread_2')?.title).toBe('Test thread');
  });
});
