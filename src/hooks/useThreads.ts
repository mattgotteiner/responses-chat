/**
 * Hook for managing chat thread history with IndexedDB persistence (via Dexie)
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Thread, Message } from '../types';
import {
  getAllThreads,
  putThread,
  updateThreadData,
  updateThreadTitle as updateThreadTitleInDb,
  deleteThread as deleteThreadFromDb,
  clearAllThreads as clearAllThreadsFromDb,
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
  createThread: (messages: Message[], previousResponseId: string | null, uploadedFileIds: string[]) => string;
  /** Delete a thread by ID */
  deleteThread: (id: string) => void;
  /** Switch to an existing thread, returns its messages and previousResponseId */
  switchThread: (id: string) => { messages: Message[]; previousResponseId: string | null; uploadedFileIds: string[] } | null;
  /** Update an existing thread's messages/previousResponseId */
  updateThread: (id: string, messages: Message[], previousResponseId: string | null, uploadedFileIds: string[]) => void;
  /** Update a thread's title */
  updateThreadTitle: (id: string, title: string) => void;
  /** Start a new chat (clears active thread) */
  startNewChat: () => void;
  /** Start an ephemeral chat that won't be saved */
  startEphemeral: () => void;
  /** Delete all threads from IndexedDB and reset state */
  clearAllThreads: () => void;
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
    (messages: Message[], previousResponseId: string | null, uploadedFileIds: string[]): string => {
      const id = generateThreadId();
      const now = Date.now();
      const thread: Thread = {
        id,
        title: 'New Chat',
        createdAt: now,
        updatedAt: now,
        messages,
        previousResponseId,
        uploadedFileIds,
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
    (id: string): { messages: Message[]; previousResponseId: string | null; uploadedFileIds: string[] } | null => {
      const thread = threadsRef.current.find((t) => t.id === id);
      if (!thread) return null;
      setActiveThreadId(id);
      setIsEphemeral(false);
      saveActiveThreadId(id);
      return {
        messages: thread.messages,
        previousResponseId: thread.previousResponseId,
        uploadedFileIds: thread.uploadedFileIds,
      };
    },
    []
  );

  const updateThread = useCallback(
    (id: string, messages: Message[], previousResponseId: string | null, uploadedFileIds: string[]) => {
      const updatedAt = Date.now();
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, messages, previousResponseId, uploadedFileIds, updatedAt } : t))
      );
      // Partial IDB update — avoids the stale-ref race where reading threadsRef
      // and doing a full putThread could overwrite concurrent field changes.
      void updateThreadData(id, messages, previousResponseId, uploadedFileIds, updatedAt);
    },
    []
  );

  const updateThreadTitle = useCallback((id: string, title: string) => {
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    // Partial IDB update — only touches the title field, never touches messages.
    void updateThreadTitleInDb(id, title);
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

  const clearAllThreads = useCallback(() => {
    setThreads([]);
    setActiveThreadId(null);
    saveActiveThreadId(null);
    void clearAllThreadsFromDb();
  }, []);

  // Sort threads by updatedAt descending — memoized to avoid re-sorting on every render
  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt - a.updatedAt),
    [threads]
  );

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
    clearAllThreads,
  };
}
