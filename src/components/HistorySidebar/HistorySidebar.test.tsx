/**
 * Tests for HistorySidebar component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistorySidebar } from './HistorySidebar';
import type { Thread } from '../../types';

function createThread(id: string, title: string, updatedAt: number): Thread {
  return {
    id,
    title,
    createdAt: updatedAt - 1000,
    updatedAt,
    messages: [],
    previousResponseId: null,
    uploadedFileIds: [],
  };
}

describe('HistorySidebar', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    threads: [] as Thread[],
    activeThreadId: null,
    isEphemeral: false,
    onSwitchThread: vi.fn(),
    onDeleteThread: vi.fn(),
    onRenameThread: vi.fn(),
    onBookmarkThread: vi.fn(),
    onNewChat: vi.fn(),
    onNewEphemeralChat: vi.fn(),
    hasMessages: false,
  };

  it('renders nothing when closed', () => {
    const { container } = render(
      <HistorySidebar {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders header and action buttons when open', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('+ New Chat')).toBeInTheDocument();
  });

  it('shows empty state when no threads', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('No conversations yet. Start chatting!')).toBeInTheDocument();
  });

  it('renders thread list', () => {
    const threads = [
      createThread('t1', 'First Thread', Date.now() - 60000),
      createThread('t2', 'Second Thread', Date.now()),
    ];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    expect(screen.getByText('First Thread')).toBeInTheDocument();
    expect(screen.getByText('Second Thread')).toBeInTheDocument();
  });

  it('calls onSwitchThread when clicking a thread', () => {
    const onSwitchThread = vi.fn();
    const threads = [createThread('t1', 'My Thread', Date.now())];
    render(
      <HistorySidebar {...defaultProps} threads={threads} onSwitchThread={onSwitchThread} />
    );
    fireEvent.click(screen.getByText('My Thread'));
    expect(onSwitchThread).toHaveBeenCalledWith('t1');
  });

  it('calls onNewChat when clicking new chat button', () => {
    const onNewChat = vi.fn();
    render(<HistorySidebar {...defaultProps} onNewChat={onNewChat} />);
    fireEvent.click(screen.getByText('+ New Chat'));
    expect(onNewChat).toHaveBeenCalledOnce();
  });

  it('calls onNewEphemeralChat when clicking ephemeral button', () => {
    const onNewEphemeralChat = vi.fn();
    render(<HistorySidebar {...defaultProps} onNewEphemeralChat={onNewEphemeralChat} />);
    fireEvent.click(screen.getByText('🕐 Ephemeral'));
    expect(onNewEphemeralChat).toHaveBeenCalledOnce();
  });

  it('shows ephemeral indicator when in ephemeral mode', () => {
    render(<HistorySidebar {...defaultProps} isEphemeral={true} />);
    expect(screen.getByText('🕐 Ephemeral Chat')).toBeInTheDocument();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
  });

  it('calls onDeleteThread when clicking delete button', () => {
    const onDeleteThread = vi.fn();
    const threads = [createThread('t1', 'My Thread', Date.now())];
    render(
      <HistorySidebar {...defaultProps} threads={threads} onDeleteThread={onDeleteThread} />
    );
    const deleteBtn = screen.getByLabelText('Delete "My Thread"');
    fireEvent.click(deleteBtn);
    expect(onDeleteThread).toHaveBeenCalledWith('t1');
  });

  it('shows streaming dot for threads in backgroundStreamingThreadIds', () => {
    const threads = [createThread('t1', 'Streaming Thread', Date.now())];
    render(
      <HistorySidebar
        {...defaultProps}
        threads={threads}
        backgroundStreamingThreadIds={new Set(['t1'])}
      />
    );
    expect(document.querySelector('.history-sidebar__streaming-dot')).toBeInTheDocument();
  });

  it('does not show streaming dot when thread is not in backgroundStreamingThreadIds', () => {
    const threads = [createThread('t1', 'Normal Thread', Date.now())];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    expect(document.querySelector('.history-sidebar__streaming-dot')).not.toBeInTheDocument();
  });

  it('shows date group headers for threads', () => {
    const now = Date.now();
    const threads = [
      createThread('t1', 'Today Thread', now - 1000),
    ];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('renders unsaved new chat indicator when active with unsaved messages', () => {
    render(
      <HistorySidebar
        {...defaultProps}
        activeThreadId={null}
        hasMessages={true}
      />
    );
    expect(screen.getByText('● Untitled chat')).toBeInTheDocument();
  });

  it('renders bookmark button for each thread', () => {
    const threads = [createThread('t1', 'My Thread', Date.now())];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    expect(screen.getByRole('button', { name: /Bookmark "My Thread"/ })).toBeInTheDocument();
  });

  it('calls onBookmarkThread when bookmark button is clicked', () => {
    const onBookmarkThread = vi.fn();
    const threads = [createThread('t1', 'My Thread', Date.now())];
    render(
      <HistorySidebar
        {...defaultProps}
        threads={threads}
        onBookmarkThread={onBookmarkThread}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Bookmark "My Thread"/ }));
    expect(onBookmarkThread).toHaveBeenCalledWith('t1', true);
  });

  it('shows filled star and remove bookmark label for bookmarked thread', () => {
    const threads = [{ ...createThread('t1', 'My Thread', Date.now()), bookmarked: true }];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    const btns = screen.getAllByRole('button', { name: /Remove bookmark for "My Thread"/ });
    expect(btns.length).toBeGreaterThan(0);
  });

  it('calls onBookmarkThread with false when removing bookmark', () => {
    const onBookmarkThread = vi.fn();
    const threads = [{ ...createThread('t1', 'My Thread', Date.now()), bookmarked: true }];
    render(
      <HistorySidebar
        {...defaultProps}
        threads={threads}
        onBookmarkThread={onBookmarkThread}
      />
    );
    // Remove from bookmarks section (first occurrence)
    fireEvent.click(screen.getAllByRole('button', { name: /Remove bookmark for "My Thread"/ })[0]);
    expect(onBookmarkThread).toHaveBeenCalledWith('t1', false);
  });

  it('shows Bookmarks section when there are bookmarked threads', () => {
    const threads = [{ ...createThread('t1', 'My Thread', Date.now()), bookmarked: true }];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    expect(screen.getByText('Bookmarks')).toBeInTheDocument();
  });

  it('does not show Bookmarks section when no threads are bookmarked', () => {
    const threads = [createThread('t1', 'My Thread', Date.now())];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    expect(screen.queryByText('Bookmarks')).not.toBeInTheDocument();
  });

  it('bookmarks section items have rename and delete buttons', () => {
    const threads = [{ ...createThread('t1', 'My Thread', Date.now()), bookmarked: true }];
    render(<HistorySidebar {...defaultProps} threads={threads} />);
    // Both the bookmarks section and the regular list render these buttons
    expect(screen.getAllByRole('button', { name: /Rename "My Thread"/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Delete "My Thread"/ })).toHaveLength(2);
  });

  it('does not render JSON import/export controls in history', () => {
    render(<HistorySidebar {...defaultProps} threads={[createThread('t1', 'My Thread', Date.now())]} />);
    expect(screen.queryByRole('button', { name: 'Export JSON' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import JSON' })).not.toBeInTheDocument();
  });
});
