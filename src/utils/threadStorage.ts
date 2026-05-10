/**
 * Async CRUD helpers for thread persistence via IndexedDB (Dexie).
 * Serialization/deserialization of Date fields lives here.
 */

import { db, type StoredThread } from './db';
import type { Thread, Message } from '../types';
import { deserializeMessages, serializeMessages } from './threadSerialization';
import {
  getStoredValue,
  setStoredValue,
  removeStoredValue,
  ACTIVE_THREAD_STORAGE_KEY,
} from './localStorage';

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
    bookmarked: thread.bookmarked,
    messages: serializeMessages(thread.messages),
  };
  await db.threads.put(stored);
}

/**
 * Partially update only the message-related fields of a thread.
 * Avoids the stale-ref race where a concurrent title update would read
 * an out-of-date messages list and overwrite it.
 */
export async function updateThreadData(
  id: string,
  messages: Message[],
  previousResponseId: string | null,
  uploadedFileIds: string[],
  updatedAt: number
): Promise<void> {
  await db.threads.update(id, {
    messages: serializeMessages(messages),
    previousResponseId,
    uploadedFileIds,
    updatedAt,
  });
}

/**
 * Partially update only the title of a thread.
 * Avoids the stale-ref race where a concurrent message update would overwrite
 * the newly-set title with the stale messages list.
 */
export async function updateThreadTitle(id: string, title: string): Promise<void> {
  await db.threads.update(id, { title });
}

/**
 * Partially update the bookmarked state of a thread.
 */
export async function updateThreadBookmarked(id: string, bookmarked: boolean): Promise<void> {
  await db.threads.update(id, { bookmarked });
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
