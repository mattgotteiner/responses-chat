/**
 * Tests for threadStorage utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Thread } from '../types';

// ---------------------------------------------------------------------------
// Mock Dexie/db so tests don't need a real IndexedDB environment
// ---------------------------------------------------------------------------
const mockThreads: Map<string, unknown> = new Map();

const mockOrderBy = {
  reverse: () => ({
    toArray: async () => Array.from(mockThreads.values()),
  }),
};

vi.mock('./db', () => ({
  db: {
    threads: {
      orderBy: vi.fn(() => mockOrderBy),
      put: vi.fn(async (row: { id: string }) => { mockThreads.set(row.id, row); }),
      delete: vi.fn(async (id: string) => { mockThreads.delete(id); }),
      clear: vi.fn(async () => { mockThreads.clear(); }),
    },
  },
}));

// Mock localStorage helpers
const localStore: Record<string, string> = {};
vi.mock('./localStorage', () => ({
  ACTIVE_THREAD_STORAGE_KEY: 'active-thread-id',
  getStoredValue: vi.fn((key: string, fallback: unknown) => {
    const raw = localStore[key];
    if (raw === undefined) return fallback;
    try { return JSON.parse(raw) as unknown; } catch { return fallback; }
  }),
  setStoredValue: vi.fn((key: string, value: unknown) => {
    localStore[key] = JSON.stringify(value);
  }),
  removeStoredValue: vi.fn((key: string) => {
    delete localStore[key];
  }),
}));

// Import under test AFTER mocks are set up
import { getAllThreads, putThread, deleteThread, clearAllThreads, getActiveThreadId, saveActiveThreadId } from './threadStorage';
import { db } from './db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeThread(id: string, overrides: Partial<Thread> = {}): Thread {
  return {
    id,
    title: 'Test Thread',
    createdAt: 1000,
    updatedAt: 2000,
    previousResponseId: null,
    uploadedFileIds: [],
    messages: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAllThreads', () => {
  beforeEach(() => {
    mockThreads.clear();
    vi.clearAllMocks();
    vi.mocked(db.threads.orderBy).mockReturnValue(mockOrderBy as ReturnType<typeof db.threads.orderBy>);
  });

  it('returns empty array when no threads stored', async () => {
    const result = await getAllThreads();
    expect(result).toEqual([]);
  });

  it('deserializes message timestamps to Date objects', async () => {
    const isoDate = '2024-01-15T10:30:00.000Z';
    mockThreads.set('t1', {
      id: 't1',
      title: 'Thread',
      createdAt: 1000,
      updatedAt: 2000,
      previousResponseId: null,
      uploadedFileIds: [],
      messages: [
        { id: 'msg1', role: 'user', content: 'Hi', timestamp: isoDate },
      ],
    });

    const threads = await getAllThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0].messages[0].timestamp).toBeInstanceOf(Date);
    expect((threads[0].messages[0].timestamp as Date).toISOString()).toBe(isoDate);
  });
});

describe('putThread', () => {
  beforeEach(() => {
    mockThreads.clear();
    vi.clearAllMocks();
    // Restore the vi.fn implementation after clearAllMocks resets call counts
    vi.mocked(db.threads.put).mockImplementation(
      vi.fn(async (row: { id: string }) => { mockThreads.set(row.id, row); }) as unknown as typeof db.threads.put
    );
  });

  it('serializes message timestamps to ISO strings', async () => {
    const thread = makeThread('t1', {
      messages: [
        { id: 'msg1', role: 'user', content: 'Hello', timestamp: new Date('2024-01-15T10:30:00.000Z') },
      ],
    });

    await putThread(thread);

    expect(db.threads.put).toHaveBeenCalledOnce();
    const stored = vi.mocked(db.threads.put).mock.calls[0][0] as { messages: Array<{ timestamp: string }> };
    expect(typeof stored.messages[0].timestamp).toBe('string');
    expect(stored.messages[0].timestamp).toBe('2024-01-15T10:30:00.000Z');
  });

  it('sanitizes isStreaming=true to false + isStopped=true', async () => {
    const thread = makeThread('t1', {
      messages: [
        { id: 'm1', role: 'user', content: 'Hi', timestamp: new Date() },
        { id: 'm2', role: 'assistant', content: 'Partial...', timestamp: new Date(), isStreaming: true },
      ],
    });

    await putThread(thread);

    const stored = vi.mocked(db.threads.put).mock.calls[0][0] as { messages: Array<Record<string, unknown>> };
    const assistantMsg = stored.messages.find((m) => m.role === 'assistant')!;
    expect(assistantMsg.isStreaming).toBe(false);
    expect(assistantMsg.isStopped).toBe(true);
  });
});

describe('deleteThread', () => {
  it('calls db.threads.delete with the given id', async () => {
    vi.mocked(db.threads.delete).mockResolvedValue(undefined);
    await deleteThread('t1');
    expect(db.threads.delete).toHaveBeenCalledWith('t1');
  });
});

describe('clearAllThreads', () => {
  it('calls db.threads.clear', async () => {
    vi.mocked(db.threads.clear).mockResolvedValue(undefined);
    await clearAllThreads();
    expect(db.threads.clear).toHaveBeenCalledOnce();
  });
});

describe('getActiveThreadId / saveActiveThreadId', () => {
  beforeEach(() => {
    // Clear the in-memory store; vi.mock factory implementations are preserved by clearAllMocks
    Object.keys(localStore).forEach((k) => { delete localStore[k]; });
  });

  it('returns null when no active thread id stored', () => {
    expect(getActiveThreadId()).toBeNull();
  });

  it('saves and retrieves an active thread id', () => {
    saveActiveThreadId('thread_123');
    expect(getActiveThreadId()).toBe('thread_123');
  });

  it('removes the active thread id when null is passed', () => {
    saveActiveThreadId('thread_123');
    saveActiveThreadId(null);
    expect(getActiveThreadId()).toBeNull();
  });
});
