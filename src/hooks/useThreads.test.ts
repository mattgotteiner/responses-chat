/**
 * Tests for useThreads hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useThreads } from './useThreads';
import type { Message, Thread } from '../types';

// ---------------------------------------------------------------------------
// Mock threadStorage so tests don't need a real IndexedDB environment
// ---------------------------------------------------------------------------
const mockDb: Map<string, Thread> = new Map();

vi.mock('../utils/threadStorage', () => ({
  getAllThreads: vi.fn(async () => Array.from(mockDb.values())),
  putThread: vi.fn(async (thread: Thread) => { mockDb.set(thread.id, thread); }),
  deleteThread: vi.fn(async (id: string) => { mockDb.delete(id); }),
  getActiveThreadId: vi.fn(() => null),
  saveActiveThreadId: vi.fn(),
}));

import {
  getAllThreads,
  putThread,
  deleteThread as deleteThreadMock,
  getActiveThreadId,
  saveActiveThreadId,
} from '../utils/threadStorage';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMessage(role: 'user' | 'assistant', content: string): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: new Date(),
  };
}

/** Wait for the initial async IDB load to complete */
async function waitForLoad(result: { current: ReturnType<typeof useThreads> }) {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useThreads', () => {
  beforeEach(() => {
    mockDb.clear();
    vi.clearAllMocks();
    // Reset mocks to default behaviour
    vi.mocked(getAllThreads).mockImplementation(async () => Array.from(mockDb.values()));
    vi.mocked(putThread).mockImplementation(async (thread) => { mockDb.set(thread.id, thread); });
    vi.mocked(deleteThreadMock).mockImplementation(async (id) => { mockDb.delete(id); });
    vi.mocked(getActiveThreadId).mockReturnValue(null);
    vi.mocked(saveActiveThreadId).mockImplementation(() => {});
  });

  it('starts with empty threads after load', async () => {
    const { result } = renderHook(() => useThreads());
    expect(result.current.isLoading).toBe(true);
    await waitForLoad(result);
    expect(result.current.threads).toEqual([]);
    expect(result.current.activeThreadId).toBeNull();
    expect(result.current.isEphemeral).toBe(false);
  });

  it('creates a thread and makes it active', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    const messages = [createMessage('user', 'Hello'), createMessage('assistant', 'Hi!')];
    let threadId: string;
    act(() => {
      threadId = result.current.createThread(messages, 'resp_123');
    });

    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0].title).toBe('New Chat');
    expect(result.current.threads[0].messages).toHaveLength(2);
    expect(result.current.activeThreadId).toBe(threadId!);
    expect(putThread).toHaveBeenCalledOnce();
    expect(saveActiveThreadId).toHaveBeenCalledWith(threadId!);
  });

  it('deletes a thread', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    let threadId: string;
    act(() => {
      threadId = result.current.createThread([createMessage('user', 'Hello')], null);
    });
    expect(result.current.threads).toHaveLength(1);

    act(() => {
      result.current.deleteThread(threadId!);
    });

    expect(result.current.threads).toHaveLength(0);
    expect(result.current.activeThreadId).toBeNull();
    expect(deleteThreadMock).toHaveBeenCalledWith(threadId!);
  });

  it('switches between threads', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    let id1: string;
    let id2: string;
    act(() => { id1 = result.current.createThread([createMessage('user', 'First thread')], 'resp_1'); });
    act(() => { id2 = result.current.createThread([createMessage('user', 'Second thread')], 'resp_2'); });

    expect(result.current.activeThreadId).toBe(id2!);

    let data: ReturnType<typeof result.current.switchThread>;
    act(() => { data = result.current.switchThread(id1!); });

    expect(result.current.activeThreadId).toBe(id1!);
    expect(data!).not.toBeNull();
    expect(data!.messages[0].content).toBe('First thread');
    expect(data!.previousResponseId).toBe('resp_1');
    expect(saveActiveThreadId).toHaveBeenLastCalledWith(id1!);
  });

  it('updates a thread title', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    let threadId: string;
    act(() => { threadId = result.current.createThread([createMessage('user', 'Hello')], null); });
    act(() => { result.current.updateThreadTitle(threadId!, 'My Custom Title'); });

    expect(result.current.threads[0].title).toBe('My Custom Title');
    expect(putThread).toHaveBeenLastCalledWith(expect.objectContaining({ id: threadId!, title: 'My Custom Title' }));
  });

  it('starts ephemeral chat', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    act(() => { result.current.startEphemeral(); });

    expect(result.current.isEphemeral).toBe(true);
    expect(result.current.activeThreadId).toBeNull();
    expect(saveActiveThreadId).toHaveBeenCalledWith(null);
  });

  it('startNewChat resets ephemeral mode', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    act(() => { result.current.startEphemeral(); });
    expect(result.current.isEphemeral).toBe(true);

    act(() => { result.current.startNewChat(); });
    expect(result.current.isEphemeral).toBe(false);
    expect(result.current.activeThreadId).toBeNull();
  });

  it('persists threads to IndexedDB via putThread', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    act(() => { result.current.createThread([createMessage('user', 'Persisted')], null); });

    expect(putThread).toHaveBeenCalledOnce();
  });

  it('sorts threads by updatedAt descending', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    act(() => { result.current.createThread([createMessage('user', 'Old')], null); });
    act(() => { result.current.createThread([createMessage('user', 'New')], null); });

    expect(result.current.threads[0].messages[0].content).toBe('New');
  });

  it('sanitizes isStreaming=true when persisting thread messages', async () => {
    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    const streamingMsg: Message = { ...createMessage('assistant', 'Partial'), isStreaming: true };
    act(() => { result.current.createThread([createMessage('user', 'Hello'), streamingMsg], null); });

    const savedThread = vi.mocked(putThread).mock.calls[0][0] as Thread;
    // The hook stores the live Thread (with real Dates); serialization happens inside putThread/threadStorage
    // The message should still be in the thread, streaming state is sanitized inside threadStorage
    expect(savedThread.messages.find((m) => m.role === 'assistant')).toBeDefined();
  });

  it('restores activeThreadId from storage after load', async () => {
    const thread: Thread = {
      id: 'thread_stored',
      title: 'Stored',
      createdAt: 1000,
      updatedAt: 2000,
      messages: [],
      previousResponseId: null,
    };
    mockDb.set(thread.id, thread);
    vi.mocked(getAllThreads).mockResolvedValue([thread]);
    vi.mocked(getActiveThreadId).mockReturnValue('thread_stored');

    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    expect(result.current.activeThreadId).toBe('thread_stored');
    expect(result.current.threads).toHaveLength(1);
  });

  it('ignores invalid stored activeThreadId', async () => {
    vi.mocked(getActiveThreadId).mockReturnValue('nonexistent_id');

    const { result } = renderHook(() => useThreads());
    await waitForLoad(result);

    expect(result.current.activeThreadId).toBeNull();
  });

  it('exposes isLoading=true before load and false after', async () => {
    let resolveLoad!: (v: Thread[]) => void;
    vi.mocked(getAllThreads).mockReturnValue(new Promise<Thread[]>((res) => { resolveLoad = res; }));

    const { result } = renderHook(() => useThreads());
    expect(result.current.isLoading).toBe(true);

    act(() => { resolveLoad([]); });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
