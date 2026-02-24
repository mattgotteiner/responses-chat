/**
 * Hook for managing chat thread history with localStorage persistence
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Thread, Message } from '../types';
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  THREADS_STORAGE_KEY,
  ACTIVE_THREAD_STORAGE_KEY,
} from '../utils/localStorage';

/** Generate a unique thread ID */
function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Serialize messages for JSON storage (Date → ISO string).
 * Any message still marked as streaming is sanitized to stopped so a
 * persisted thread never reloads in a broken mid-stream state.
 */
function serializeMessages(messages: Message[]): unknown[] {
  return messages.map((msg) => ({
    ...msg,
    timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    ...(msg.isStreaming && { isStreaming: false, isStopped: true }),
  }));
}

/**
 * Deserialize messages from JSON storage (ISO string → Date)
 */
function deserializeMessages(raw: unknown[]): Message[] {
  return (raw as Array<Record<string, unknown>>).map((msg) => ({
    ...msg,
    timestamp: new Date(msg.timestamp as string),
  })) as Message[];
}

/** Return type for the useThreads hook */
export interface UseThreadsReturn {
  /** All saved threads, sorted by updatedAt descending */
  threads: Thread[];
  /** Currently active thread ID (null = new unsaved chat) */
  activeThreadId: string | null;
  /** Whether the current session is ephemeral (not persisted) */
  isEphemeral: boolean;
  /** Create a new thread from messages and make it active */
  createThread: (messages: Message[], previousResponseId: string | null) => string;
  /** Delete a thread by ID */
  deleteThread: (id: string) => void;
  /** Switch to an existing thread, returns its messages and previousResponseId */
  switchThread: (id: string) => { messages: Message[]; previousResponseId: string | null } | null;
  /** Update an existing thread's messages/previousResponseId */
  updateThread: (id: string, messages: Message[], previousResponseId: string | null) => void;
  /** Update a thread's title */
  updateThreadTitle: (id: string, title: string) => void;
  /** Start a new chat (clears active thread) */
  startNewChat: () => void;
  /** Start an ephemeral chat that won't be saved */
  startEphemeral: () => void;
}

/**
 * Hook for managing chat thread history with localStorage persistence
 *
 * @returns Thread management functions and state
 *
 * @example
 * const { threads, activeThreadId, createThread, switchThread } = useThreads();
 *
 * // Create a thread after first message
 * const threadId = createThread(messages, previousResponseId);
 *
 * // Switch to an existing thread
 * const data = switchThread(threadId);
 * if (data) loadMessages(data.messages);
 */
export function useThreads(): UseThreadsReturn {
  const [threads, setThreads] = useState<Thread[]>(() => {
    const stored = getStoredValue<unknown[]>(THREADS_STORAGE_KEY, []);
    try {
      return (stored as Array<Record<string, unknown>>).map((t) => ({
        ...t,
        messages: deserializeMessages(t.messages as unknown[]),
      })) as Thread[];
    } catch {
      return [];
    }
  });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    const storedId = getStoredValue<string | null>(ACTIVE_THREAD_STORAGE_KEY, null);
    if (!storedId) return null;
    // Validate the stored ID still exists in the saved threads
    const rawThreads = getStoredValue<Array<{ id: unknown }>>(THREADS_STORAGE_KEY, []);
    return rawThreads.some((t) => t.id === storedId) ? storedId : null;
  });
  const [isEphemeral, setIsEphemeral] = useState(false);

  // Use a ref to avoid stale closures in persist effect
  const threadsRef = useRef(threads);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Persist threads to localStorage whenever they change
  useEffect(() => {
    const serialized = threads.map((t) => ({
      ...t,
      messages: serializeMessages(t.messages),
    }));
    setStoredValue(THREADS_STORAGE_KEY, serialized);
  }, [threads]);

  // Persist active thread ID whenever it changes
  useEffect(() => {
    if (activeThreadId) {
      setStoredValue(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);
    } else {
      removeStoredValue(ACTIVE_THREAD_STORAGE_KEY);
    }
  }, [activeThreadId]);

  const createThread = useCallback(
    (messages: Message[], previousResponseId: string | null): string => {
      const id = generateThreadId();
      const now = Date.now();
      const thread: Thread = {
        id,
        title: 'New Chat',
        createdAt: now,
        updatedAt: now,
        messages,
        previousResponseId,
      };
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(id);
      setIsEphemeral(false);
      return id;
    },
    []
  );

  const deleteThread = useCallback(
    (id: string) => {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      // If deleting the active thread, clear the active state
      setActiveThreadId((current) => (current === id ? null : current));
    },
    []
  );

  const switchThread = useCallback(
    (id: string): { messages: Message[]; previousResponseId: string | null } | null => {
      const thread = threadsRef.current.find((t) => t.id === id);
      if (!thread) return null;
      setActiveThreadId(id);
      setIsEphemeral(false);
      return {
        messages: thread.messages,
        previousResponseId: thread.previousResponseId,
      };
    },
    []
  );

  const updateThread = useCallback(
    (id: string, messages: Message[], previousResponseId: string | null) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, messages, previousResponseId, updatedAt: Date.now() }
            : t
        )
      );
    },
    []
  );

  const updateThreadTitle = useCallback((id: string, title: string) => {
    setThreads((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title } : t))
    );
  }, []);

  const startNewChat = useCallback(() => {
    setActiveThreadId(null);
    setIsEphemeral(false);
  }, []);

  const startEphemeral = useCallback(() => {
    setActiveThreadId(null);
    setIsEphemeral(true);
  }, []);

  // Sort threads by updatedAt descending
  const sortedThreads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    threads: sortedThreads,
    activeThreadId,
    isEphemeral,
    createThread,
    deleteThread,
    switchThread,
    updateThread,
    updateThreadTitle,
    startNewChat,
    startEphemeral,
  };
}
