/**
 * History sidebar for browsing and managing chat threads
 */

import { useCallback, useMemo, useState, useRef } from 'react';
import type { Thread } from '../../types';
import './HistorySidebar.css';

/** Format a timestamp as a relative time string */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/** Format a timestamp as a short time string (e.g., "2:30 PM") */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Get the date group label for a timestamp */
function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const threadDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (threadDay.getTime() === today.getTime()) return 'Today';
  if (threadDay.getTime() === yesterday.getTime()) return 'Yesterday';
  if (now.getTime() - threadDay.getTime() < 7 * 86400000) return 'This Week';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined });
}

interface HistorySidebarProps {
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Handler to close the sidebar */
  onClose: () => void;
  /** All saved threads */
  threads: Thread[];
  /** Currently active thread ID */
  activeThreadId: string | null;
  /** Whether the current session is ephemeral */
  isEphemeral: boolean;
  /** Handler to switch to a thread */
  onSwitchThread: (id: string) => void;
  /** Handler to delete a thread */
  onDeleteThread: (id: string) => void;
  /** Handler to start a new chat */
  onNewChat: () => void;
  /** Handler to start an ephemeral chat */
  onNewEphemeralChat: () => void;
  /** Whether there are messages in the current (possibly unsaved) chat */
  hasMessages: boolean;
  /** Handler to rename a thread */
  onRenameThread: (id: string, title: string) => void;
  /** Handler to toggle bookmark on a thread */
  onBookmarkThread: (id: string, bookmarked: boolean) => void;
  /** Thread IDs that have a stream running in the background */
  backgroundStreamingThreadIds?: Set<string>;
  /** Thread IDs that are currently having a title generated */
  generatingTitleThreadIds?: Set<string>;
}

/**
 * Slide-in history sidebar from the left side
 */
export function HistorySidebar({
  isOpen,
  onClose,
  threads,
  activeThreadId,
  isEphemeral,
  onSwitchThread,
  onDeleteThread,
  onRenameThread,
  onBookmarkThread,
  onNewChat,
  onNewEphemeralChat,
  hasMessages,
  backgroundStreamingThreadIds,
  generatingTitleThreadIds,
}: HistorySidebarProps) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, threadId: string) => {
      e.stopPropagation();
      onDeleteThread(threadId);
    },
    [onDeleteThread]
  );

  const handleBookmarkClick = useCallback(
    (e: React.MouseEvent, thread: Thread) => {
      e.stopPropagation();
      onBookmarkThread(thread.id, !thread.bookmarked);
    },
    [onBookmarkThread]
  );

  const handleEditClick = useCallback(
    (e: React.MouseEvent, thread: Thread) => {
      e.stopPropagation();
      setEditingThreadId(thread.id);
      setEditingTitle(thread.title);
      // Focus the input after render
      setTimeout(() => editInputRef.current?.focus(), 0);
    },
    []
  );

  const handleEditSave = useCallback(
    (threadId: string) => {
      const trimmed = editingTitle.trim();
      if (trimmed) {
        onRenameThread(threadId, trimmed);
      }
      setEditingThreadId(null);
    },
    [editingTitle, onRenameThread]
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent, threadId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEditSave(threadId);
      } else if (e.key === 'Escape') {
        setEditingThreadId(null);
      }
    },
    [handleEditSave]
  );

  // Pre-compute group headers by comparing each thread's date group to the previous one
  const threadsWithGroups = useMemo(
    () => threads.map((thread, i) => {
      const group = getDateGroup(thread.updatedAt);
      const showGroupHeader = group !== (i > 0 ? getDateGroup(threads[i - 1].updatedAt) : '');
      return { thread, group, showGroupHeader };
    }),
    [threads]
  );

  // Bookmarked threads sorted by updatedAt descending (threads prop is already sorted)
  const bookmarkedThreads = useMemo(
    () => threads.filter((t) => t.bookmarked),
    [threads]
  );

  if (!isOpen) {
    return <></>;
  }

  return (
    <div className="history-overlay" onClick={handleOverlayClick}>
      <div className="history-sidebar">
        <div className="history-sidebar__header">
          <h2 className="history-sidebar__title">History</h2>
          <button
            className="history-sidebar__close"
            onClick={onClose}
            aria-label="Close history"
          >
            ✕
          </button>
        </div>

        <div className="history-sidebar__actions">
          <button
            className="history-sidebar__new-chat"
            onClick={() => { onNewChat(); onClose(); }}
          >
            + New Chat
          </button>
          <button
            className="history-sidebar__ephemeral-chat"
            onClick={() => { onNewEphemeralChat(); onClose(); }}
            title="Start a chat that won't be saved to history"
          >
            🕐 Ephemeral
          </button>
        </div>

        <div className="history-sidebar__list">
          {isEphemeral && (
            <div className="history-sidebar__item history-sidebar__item--active history-sidebar__item--ephemeral">
              <div className="history-sidebar__item-content">
                <span className="history-sidebar__item-title">🕐 Ephemeral Chat</span>
                <span className="history-sidebar__item-time">Not saved</span>
              </div>
            </div>
          )}

          {!isEphemeral && !activeThreadId && hasMessages && (
            <div className="history-sidebar__item history-sidebar__item--active history-sidebar__item--unsaved">
              <div className="history-sidebar__item-content">
                <span className="history-sidebar__item-title">● New Chat</span>
                <span className="history-sidebar__item-time">Unsaved</span>
              </div>
            </div>
          )}

          {threads.length === 0 && !isEphemeral && !hasMessages && (
            <div className="history-sidebar__empty">
              No conversations yet. Start chatting!
            </div>
          )}

          {bookmarkedThreads.length > 0 && (
            <div className="history-sidebar__bookmarks-section">
              <div className="history-sidebar__date-group">Bookmarks</div>
              {bookmarkedThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`history-sidebar__item ${
                    thread.id === activeThreadId ? 'history-sidebar__item--active' : ''
                  }`}
                >
                  {editingThreadId === thread.id ? (
                    <input
                      ref={editInputRef}
                      className="history-sidebar__item-title-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleEditSave(thread.id)}
                      onKeyDown={(e) => handleEditKeyDown(e, thread.id)}
                      aria-label="Edit thread title"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      className="history-sidebar__item-main"
                      onClick={() => { onSwitchThread(thread.id); onClose(); }}
                    >
                      <div className="history-sidebar__item-content">
                        <span className="history-sidebar__item-title">
                          {backgroundStreamingThreadIds?.has(thread.id) && (
                            <span className="history-sidebar__streaming-dot" title="Streaming in background" />
                          )}
                          {generatingTitleThreadIds?.has(thread.id) ? (
                            <span className="history-sidebar__generating-title" title="Generating title…">
                              <span className="history-sidebar__generating-dots" />
                              <span className="history-sidebar__item-title-text">{thread.title}</span>
                            </span>
                          ) : (
                            <span className="history-sidebar__item-title-text">{thread.title}</span>
                          )}
                        </span>
                        <span className="history-sidebar__item-time" title={new Date(thread.updatedAt).toLocaleString()}>
                          {formatTime(thread.updatedAt)} · {formatRelativeTime(thread.updatedAt)}
                        </span>
                      </div>
                    </button>
                  )}
                  {editingThreadId !== thread.id && (
                    <button
                      className="history-sidebar__item-edit"
                      onClick={(e) => handleEditClick(e, thread)}
                      aria-label={`Rename "${thread.title}"`}
                      title="Rename thread"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    className="history-sidebar__item-bookmark history-sidebar__item-bookmark--active"
                    onClick={(e) => handleBookmarkClick(e, thread)}
                    aria-label={`Remove bookmark for "${thread.title}"`}
                    title="Remove bookmark"
                  >
                    ★
                  </button>
                  <button
                    className="history-sidebar__item-delete"
                    onClick={(e) => handleDeleteClick(e, thread.id)}
                    aria-label={`Delete "${thread.title}"`}
                    title="Delete thread"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}

          {threadsWithGroups.map(({ thread, showGroupHeader, group }) => (
            <div key={thread.id}>
              {showGroupHeader && (
                <div className="history-sidebar__date-group">{group}</div>
              )}
                  <div
                    className={`history-sidebar__item ${
                      thread.id === activeThreadId ? 'history-sidebar__item--active' : ''
                    }`}
                  >
                    {editingThreadId === thread.id ? (
                      <input
                        ref={editInputRef}
                        className="history-sidebar__item-title-input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleEditSave(thread.id)}
                        onKeyDown={(e) => handleEditKeyDown(e, thread.id)}
                        aria-label="Edit thread title"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        className="history-sidebar__item-main"
                        onClick={() => { onSwitchThread(thread.id); onClose(); }}
                      >
                        <div className="history-sidebar__item-content">
                          <span className="history-sidebar__item-title">
                            {backgroundStreamingThreadIds?.has(thread.id) && (
                              <span className="history-sidebar__streaming-dot" title="Streaming in background" />
                            )}
                            {generatingTitleThreadIds?.has(thread.id) ? (
                              <span className="history-sidebar__generating-title" title="Generating title…">
                                <span className="history-sidebar__generating-dots" />
                                <span className="history-sidebar__item-title-text">{thread.title}</span>
                              </span>
                            ) : (
                              <span className="history-sidebar__item-title-text">{thread.title}</span>
                            )}
                          </span>
                          <span className="history-sidebar__item-time" title={new Date(thread.updatedAt).toLocaleString()}>
                            {formatTime(thread.updatedAt)} · {formatRelativeTime(thread.updatedAt)}
                          </span>
                        </div>
                      </button>
                    )}
                    {editingThreadId !== thread.id && (
                      <button
                        className="history-sidebar__item-edit"
                        onClick={(e) => handleEditClick(e, thread)}
                        aria-label={`Rename "${thread.title}"`}
                        title="Rename thread"
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      className={`history-sidebar__item-bookmark${thread.bookmarked ? ' history-sidebar__item-bookmark--active' : ''}`}
                      onClick={(e) => handleBookmarkClick(e, thread)}
                      aria-label={thread.bookmarked ? `Remove bookmark for "${thread.title}"` : `Bookmark "${thread.title}"`}
                      title={thread.bookmarked ? 'Remove bookmark' : 'Bookmark thread'}
                    >
                      {thread.bookmarked ? '★' : '☆'}
                    </button>
                    <button
                      className="history-sidebar__item-delete"
                      onClick={(e) => handleDeleteClick(e, thread.id)}
                      aria-label={`Delete "${thread.title}"`}
                      title="Delete thread"
                    >
                      🗑
                    </button>
                  </div>
                </div>
          ))}
        </div>
      </div>
    </div>
  );
}
