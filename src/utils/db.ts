/**
 * Dexie (IndexedDB) database definition for the chat application.
 * Threads are stored as full objects with serialized messages embedded.
 */

import Dexie, { type EntityTable } from 'dexie';

/** A thread row as stored in IndexedDB (messages are JSON-serialized) */
export interface StoredThread {
  /** Primary key — "thread_<timestamp>_<random>" */
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  previousResponseId: string | null;
  /** Serialized messages: Date fields stored as ISO strings */
  messages: unknown[];
}

class ChatDatabase extends Dexie {
  threads!: EntityTable<StoredThread, 'id'>;

  constructor() {
    super('responses-chat');
    this.version(1).stores({
      // id is the primary key; updatedAt and createdAt are indexed for sorting
      threads: 'id, updatedAt, createdAt',
    });
  }
}

export const db = new ChatDatabase();
