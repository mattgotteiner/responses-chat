/**
 * Hook for managing chat thread history with IndexedDB persistence (via Dexie)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Thread, Message } from '../types';
import {
  getAllThreads,
  putThread,
  deleteThread as deleteThreadFromDb,
  getActiveThreadId,
  saveActiveThreadId,
} from '../utils/threadStorage';

/** Generate a unique thread ID */
function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/** Return type for the useThreads hook */
export interface UseThreadsReturn {
  /** All saved threads, sorted by updatedAt descending */
  threads: Thread[];
  /** Currently active thread ID (null = new unsaved chat) */
  activeThreadId: string | null;
  /** Whether thread history is still being loaded from IndexedDB */
  isLoading: boolean;
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
 * Hook for managing chat thread history with IndexedDB persistence
 *
 * @returns Thread management functions and state
 *
 * @example
 * const { threads, activeThreadId, isLoading, createThread, switchThread } = useThreads();
 *
 * // Create a thread after first message
 * const threadId = createThread(messages, previousResponseId);
 *
 * // Switch to an existing thread
 * const data = switchThread(threadId);
 * if (data) loadMessages(data.messages);
 */
export function useThreads(): UseThreadsReturn {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEphemeral, setIsEphemeral] = useState(false);

  // Keep a ref for use in callbacks that would otherwise capture stale state
  const threadsRef = useRef(threads);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  // Load all threads from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    getAllThreads()
      .then((loaded) => {
        if (cancelled) return;
        setThreads(loaded);
        // Restore and validate the persisted active thread ID
        const storedId = getActiveThreadId();
        if (storedId && loaded.some((t) => t.id === storedId)) {
          setActiveThreadId(storedId);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      void putThread(thread);
      saveActiveThreadId(id);
      return id;
    },
    []
  );

  const deleteThread = useCallback((id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    setActiveThreadId((current) => {
      const next = current === id ? null : current;
      saveActiveThreadId(next);
      return next;
    });
    void deleteThreadFromDb(id);
  }, []);

  const switchThread = useCallback(
    (id: string): { messages: Message[]; previousResponseId: string | null } | null => {
      const thread = threadsRef.current.find((t) => t.id === id);
      if (!thread) return null;
      setActiveThreadId(id);
      setIsEphemeral(false);
      saveActiveThreadId(id);
      return {
        messages: thread.messages,
        previousResponseId: thread.previousResponseId,
      };
    },
    []
  );

  const updateThread = useCallback(
    (id: string, messages: Message[], previousResponseId: string | null) => {
      setThreads((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, messages, previousResponseId, updatedAt: Date.now() } : t
        );
        const updated = next.find((t) => t.id === id);
        if (updated) void putThread(updated);
        return next;
      });
    },
    []
  );

  const updateThreadTitle = useCallback((id: string, title: string) => {
    setThreads((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, title } : t));
      const updated = next.find((t) => t.id === id);
      if (updated) void putThread(updated);
      return next;
    });
  }, []);

  const startNewChat = useCallback(() => {
    setActiveThreadId(null);
    setIsEphemeral(false);
    saveActiveThreadId(null);
  }, []);

  const startEphemeral = useCallback(() => {
    setActiveThreadId(null);
    setIsEphemeral(true);
    saveActiveThreadId(null);
  }, []);

  // Sort threads by updatedAt descending
  const sortedThreads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    threads: sortedThreads,
    activeThreadId,
    isLoading,
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
