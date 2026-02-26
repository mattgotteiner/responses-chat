/**
 * Async CRUD helpers for thread persistence via IndexedDB (Dexie).
 * Serialization/deserialization of Date fields lives here.
 */

import { db, type StoredThread } from './db';
import type { Thread, Message } from '../types';
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  ACTIVE_THREAD_STORAGE_KEY,
} from './localStorage';

/**
 * Serialize messages for storage: Date → ISO string.
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

/** Deserialize messages from storage: ISO string → Date */
function deserializeMessages(raw: unknown[]): Message[] {
  return (raw as Array<Record<string, unknown>>).map((msg) => ({
    ...msg,
    timestamp: new Date(msg.timestamp as string),
  })) as Message[];
}

/**
 * Load all threads from IndexedDB, sorted by updatedAt descending.
 */
export async function getAllThreads(): Promise<Thread[]> {
  const stored = await db.threads.orderBy('updatedAt').reverse().toArray();
  return stored.map((t) => ({
    ...t,
    uploadedFileIds: t.uploadedFileIds ?? [],
    messages: deserializeMessages(t.messages),
  }));
}

/**
 * Write (insert or update) a single thread to IndexedDB.
 */
export async function putThread(thread: Thread): Promise<void> {
  const stored: StoredThread = {
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    previousResponseId: thread.previousResponseId,
    uploadedFileIds: thread.uploadedFileIds,
    messages: serializeMessages(thread.messages),
  };
  await db.threads.put(stored);
}

/**
 * Delete a thread from IndexedDB by ID.
 */
export async function deleteThread(id: string): Promise<void> {
  await db.threads.delete(id);
}

/**
 * Delete all threads from IndexedDB.
 */
export async function clearAllThreads(): Promise<void> {
  await db.threads.clear();
}

/** Read the active thread ID from localStorage (it's a single tiny string). */
export function getActiveThreadId(): string | null {
  return getStoredValue<string | null>(ACTIVE_THREAD_STORAGE_KEY, null);
}

/** Persist the active thread ID to localStorage. */
export function saveActiveThreadId(id: string | null): void {
  if (id) {
    setStoredValue(ACTIVE_THREAD_STORAGE_KEY, id);
  } else {
    removeStoredValue(ACTIVE_THREAD_STORAGE_KEY);
  }
}
