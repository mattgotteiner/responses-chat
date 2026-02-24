/**
 * Tests for useThreads hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useThreads } from './useThreads';
import type { Message } from '../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function createMessage(role: 'user' | 'assistant', content: string): Message {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: new Date(),
  };
}

describe('useThreads', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('starts with empty threads', () => {
    const { result } = renderHook(() => useThreads());
    expect(result.current.threads).toEqual([]);
    expect(result.current.activeThreadId).toBeNull();
    expect(result.current.isEphemeral).toBe(false);
  });

  it('creates a thread and makes it active', () => {
    const { result } = renderHook(() => useThreads());
    const messages = [createMessage('user', 'Hello'), createMessage('assistant', 'Hi!')];

    let threadId: string;
    act(() => {
      threadId = result.current.createThread(messages, 'resp_123');
    });

    expect(result.current.threads).toHaveLength(1);
    expect(result.current.threads[0].title).toBe('New Chat');
    expect(result.current.threads[0].messages).toHaveLength(2);
    expect(result.current.activeThreadId).toBe(threadId!);
  });

  it('deletes a thread', () => {
    const { result } = renderHook(() => useThreads());
    const messages = [createMessage('user', 'Hello')];

    let threadId: string;
    act(() => {
      threadId = result.current.createThread(messages, null);
    });

    expect(result.current.threads).toHaveLength(1);

    act(() => {
      result.current.deleteThread(threadId!);
    });

    expect(result.current.threads).toHaveLength(0);
    expect(result.current.activeThreadId).toBeNull();
  });

  it('switches between threads', () => {
    const { result } = renderHook(() => useThreads());
    const messages1 = [createMessage('user', 'First thread')];
    const messages2 = [createMessage('user', 'Second thread')];

    let id1: string;
    let id2: string;
    act(() => {
      id1 = result.current.createThread(messages1, 'resp_1');
    });
    act(() => {
      id2 = result.current.createThread(messages2, 'resp_2');
    });

    expect(result.current.activeThreadId).toBe(id2!);

    let data: ReturnType<typeof result.current.switchThread>;
    act(() => {
      data = result.current.switchThread(id1!);
    });

    expect(result.current.activeThreadId).toBe(id1!);
    expect(data!).not.toBeNull();
    expect(data!.messages[0].content).toBe('First thread');
    expect(data!.previousResponseId).toBe('resp_1');
  });

  it('updates a thread title', () => {
    const { result } = renderHook(() => useThreads());
    const messages = [createMessage('user', 'Hello')];

    let threadId: string;
    act(() => {
      threadId = result.current.createThread(messages, null);
    });

    act(() => {
      result.current.updateThreadTitle(threadId!, 'My Custom Title');
    });

    expect(result.current.threads[0].title).toBe('My Custom Title');
  });

  it('starts ephemeral chat', () => {
    const { result } = renderHook(() => useThreads());

    act(() => {
      result.current.startEphemeral();
    });

    expect(result.current.isEphemeral).toBe(true);
    expect(result.current.activeThreadId).toBeNull();
  });

  it('startNewChat resets ephemeral mode', () => {
    const { result } = renderHook(() => useThreads());

    act(() => {
      result.current.startEphemeral();
    });

    expect(result.current.isEphemeral).toBe(true);

    act(() => {
      result.current.startNewChat();
    });

    expect(result.current.isEphemeral).toBe(false);
    expect(result.current.activeThreadId).toBeNull();
  });

  it('persists threads to localStorage', () => {
    const { result } = renderHook(() => useThreads());
    const messages = [createMessage('user', 'Persisted')];

    act(() => {
      result.current.createThread(messages, null);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'chat-threads',
      expect.any(String)
    );
  });

  it('sorts threads by updatedAt descending', () => {
    const { result } = renderHook(() => useThreads());

    act(() => {
      result.current.createThread([createMessage('user', 'Old')], null);
    });

    // Small delay to ensure different timestamps
    act(() => {
      result.current.createThread([createMessage('user', 'New')], null);
    });

    expect(result.current.threads[0].messages[0].content).toBe('New');
  });

  it('sanitizes isStreaming=true when persisting thread messages', () => {
    const { result } = renderHook(() => useThreads());
    const streamingMsg: Message = {
      ...createMessage('assistant', 'Partial response'),
      isStreaming: true,
    };
    const messages = [createMessage('user', 'Hello'), streamingMsg];

    act(() => {
      result.current.createThread(messages, null);
    });

    const threadSetCalls = localStorageMock.setItem.mock.calls.filter(
      (call) => call[0] === 'chat-threads'
    );
    const lastCall = threadSetCalls[threadSetCalls.length - 1];
    expect(lastCall).toBeDefined();
    const savedThreads = JSON.parse(lastCall![1]);
    const assistantMsg = savedThreads[0].messages.find(
      (m: Record<string, unknown>) => m.role === 'assistant'
    );
    expect(assistantMsg.isStreaming).toBe(false);
    expect(assistantMsg.isStopped).toBe(true);
  });

  it('persists and restores activeThreadId', () => {
    const { result: r1 } = renderHook(() => useThreads());
    let threadId: string;

    act(() => {
      threadId = r1.current.createThread([createMessage('user', 'Hi')], null);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'active-thread-id',
      expect.any(String)
    );

    // A new hook instance should restore the active thread ID from localStorage
    const { result: r2 } = renderHook(() => useThreads());
    expect(r2.current.activeThreadId).toBe(threadId!);
  });
});
