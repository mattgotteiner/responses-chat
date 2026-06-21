import type { Message, Thread } from '../types';
import { serializeMessages } from './threadSerialization';

const EXPORT_FORMAT = 'responses-chat-threads';
const SINGLE_THREAD_EXPORT_FORMAT = 'responses-chat-thread';
const EXPORT_VERSION = 1;

export interface ThreadsExportPayload {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  threads: ExportedThread[];
}

export interface SingleThreadExportPayload {
  format: typeof SINGLE_THREAD_EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  thread: ExportedThread;
}

interface ExportedThread extends Omit<Thread, 'messages'> {
  messages: unknown[];
}

export interface ThreadImportResult {
  imported: number;
  skipped: number;
  replaced: number;
  changedThreadIds: string[];
  threads: Thread[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function deserializeMessages(messages: unknown): Message[] {
  if (!Array.isArray(messages)) {
    throw new Error('Thread export is invalid: thread messages must be an array.');
  }

  return messages.map((message) => {
    if (!isRecord(message)) {
      throw new Error('Thread export is invalid: message entries must be objects.');
    }

    if (
      typeof message['id'] !== 'string' ||
      (message['role'] !== 'user' && message['role'] !== 'assistant') ||
      typeof message['content'] !== 'string'
    ) {
      throw new Error('Thread export is invalid: message id, role, and content are required.');
    }

    const rawTimestamp = message['timestamp'];
    const timestamp =
      rawTimestamp instanceof Date ? rawTimestamp : new Date(String(rawTimestamp));
    if (Number.isNaN(timestamp.getTime())) {
      throw new Error('Thread export is invalid: message timestamp is invalid.');
    }

    return {
      ...message,
      timestamp,
      ...(message['isStreaming'] === true && { isStreaming: false, isStopped: true }),
    } as Message;
  });
}

function toOptionalStringArray(value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error('Thread export is invalid: uploadedFileIds must be an array of strings.');
  }

  return value;
}

function parseThread(value: unknown): Thread {
  if (!isRecord(value)) {
    throw new Error('Thread export is invalid: thread entries must be objects.');
  }

  if (
    typeof value['id'] !== 'string' ||
    typeof value['title'] !== 'string' ||
    typeof value['createdAt'] !== 'number' ||
    typeof value['updatedAt'] !== 'number' ||
    (value['previousResponseId'] !== null && typeof value['previousResponseId'] !== 'string')
  ) {
    throw new Error('Thread export is invalid: thread metadata is missing or malformed.');
  }

  if (
    value['bookmarked'] !== undefined &&
    typeof value['bookmarked'] !== 'boolean'
  ) {
    throw new Error('Thread export is invalid: bookmarked must be a boolean.');
  }

  return {
    id: value['id'],
    title: value['title'],
    createdAt: value['createdAt'],
    updatedAt: value['updatedAt'],
    previousResponseId: value['previousResponseId'],
    uploadedFileIds: toOptionalStringArray(value['uploadedFileIds']),
    bookmarked: value['bookmarked'],
    messages: deserializeMessages(value['messages']),
  };
}

export function createThreadsExportPayload(threads: Thread[]): ThreadsExportPayload {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      previousResponseId: thread.previousResponseId,
      uploadedFileIds: thread.uploadedFileIds,
      bookmarked: thread.bookmarked,
      messages: serializeMessages(thread.messages),
    })),
  };
}

export function createThreadExportPayload(thread: Thread): SingleThreadExportPayload {
  return {
    format: SINGLE_THREAD_EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      previousResponseId: thread.previousResponseId,
      uploadedFileIds: thread.uploadedFileIds,
      bookmarked: thread.bookmarked,
      messages: serializeMessages(thread.messages),
    },
  };
}

export function stringifyThreadsExport(threads: Thread[]): string {
  return `${JSON.stringify(createThreadsExportPayload(threads), null, 2)}\n`;
}

export function stringifyThreadExport(thread: Thread): string {
  return `${JSON.stringify(createThreadExportPayload(thread), null, 2)}\n`;
}

export function getUtf8ByteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function parseThreadsExport(json: string): Thread[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    throw new Error('Thread export is invalid: file must contain valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Thread export is invalid: top-level value must be an object.');
  }

  if (parsed['version'] !== EXPORT_VERSION) {
    throw new Error('Thread export is invalid: unsupported format or version.');
  }

  if (parsed['format'] === EXPORT_FORMAT) {
    if (!Array.isArray(parsed['threads'])) {
      throw new Error('Thread export is invalid: threads must be an array.');
    }

    const seenIds = new Set<string>();
    return parsed['threads'].map((entry) => {
      const thread = parseThread(entry);
      if (seenIds.has(thread.id)) {
        throw new Error(`Thread export is invalid: duplicate thread id "${thread.id}".`);
      }
      seenIds.add(thread.id);
      return thread;
    });
  }

  if (parsed['format'] === SINGLE_THREAD_EXPORT_FORMAT) {
    return [parseThread(parsed['thread'])];
  }

  throw new Error('Thread export is invalid: unsupported format or version.');
}

export function mergeImportedThreads(
  existingThreads: Thread[],
  importedThreads: Thread[]
): ThreadImportResult {
  const existingById = new Map(existingThreads.map((thread) => [thread.id, thread]));
  const mergedById = new Map(existingById);
  let imported = 0;
  let skipped = 0;
  let replaced = 0;
  const changedThreadIds: string[] = [];

  for (const importedThread of importedThreads) {
    const existing = existingById.get(importedThread.id);
    if (!existing) {
      mergedById.set(importedThread.id, importedThread);
      imported += 1;
      changedThreadIds.push(importedThread.id);
      continue;
    }

    if (importedThread.updatedAt > existing.updatedAt) {
      mergedById.set(importedThread.id, importedThread);
      replaced += 1;
      changedThreadIds.push(importedThread.id);
    } else {
      skipped += 1;
    }
  }

  return {
    imported,
    skipped,
    replaced,
    changedThreadIds,
    threads: Array.from(mergedById.values()).sort((a, b) => b.updatedAt - a.updatedAt),
  };
}
