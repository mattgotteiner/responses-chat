import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageList } from './MessageList';
import type { Message } from '../../types';
import { SettingsProvider } from '../../context/SettingsContext';
import type { ReactElement } from 'react';

// Mock scrollIntoView
const scrollIntoViewMock = vi.fn();
window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

/**
 * Helper to render components with SettingsProvider
 */
function renderWithSettings(ui: ReactElement) {
  return render(
    <SettingsProvider>{ui}</SettingsProvider>
  );
}

describe('MessageList', () => {
  const mockOnOpenJsonPanel = vi.fn();

  const createMessage = (
    id: string,
    role: 'user' | 'assistant',
    content: string
  ): Message => ({
    id,
    role,
    content,
    timestamp: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('shows configuration prompt when not configured', () => {
      renderWithSettings(
        <MessageList
          messages={[]}
          isConfigured={false}
          onOpenJsonPanel={mockOnOpenJsonPanel}
        />
      );

      expect(
        screen.getByText('Configure your Azure OpenAI settings to get started')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Click the gear icon in the header')
      ).toBeInTheDocument();
    });

    it('shows conversation prompt when configured', () => {
      renderWithSettings(
        <MessageList
          messages={[]}
          isConfigured={true}
          onOpenJsonPanel={mockOnOpenJsonPanel}
        />
      );

      expect(
        screen.getByText('Start a conversation by typing a message below')
      ).toBeInTheDocument();
    });
  });

  describe('message rendering', () => {
    it('renders messages', () => {
      const messages = [
        createMessage('1', 'user', 'Hello'),
        createMessage('2', 'assistant', 'Hi there!'),
      ];

      renderWithSettings(
        <MessageList
          messages={messages}
          isConfigured={true}
          onOpenJsonPanel={mockOnOpenJsonPanel}
        />
      );

      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  describe('auto-scroll behavior', () => {
    it('auto-scrolls to bottom when messages change and user is at bottom', () => {
      const messages = [createMessage('1', 'user', 'Hello')];

      const { rerender } = render(
        <SettingsProvider>
          <MessageList
            messages={messages}
            isConfigured={true}
            onOpenJsonPanel={mockOnOpenJsonPanel}
          />
        </SettingsProvider>
      );

      expect(scrollIntoViewMock).toHaveBeenCalled();
      scrollIntoViewMock.mockClear();

      const newMessages = [
        ...messages,
        createMessage('2', 'assistant', 'Response'),
      ];

      rerender(
        <SettingsProvider>
          <MessageList
            messages={newMessages}
            isConfigured={true}
            onOpenJsonPanel={mockOnOpenJsonPanel}
          />
        </SettingsProvider>
      );

      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    it('does not auto-scroll when user has scrolled up', () => {
      const messages = [createMessage('1', 'user', 'Hello')];

      const { container, rerender } = render(
        <SettingsProvider>
          <MessageList
            messages={messages}
            isConfigured={true}
            onOpenJsonPanel={mockOnOpenJsonPanel}
          />
        </SettingsProvider>
      );

      scrollIntoViewMock.mockClear();

      // Simulate scrolling up (user not at bottom)
      const messageList = container.querySelector('.message-list');
      if (messageList) {
        Object.defineProperty(messageList, 'scrollTop', { value: 0, writable: true });
        Object.defineProperty(messageList, 'scrollHeight', { value: 1000, writable: true });
        Object.defineProperty(messageList, 'clientHeight', { value: 400, writable: true });
        fireEvent.scroll(messageList);
      }

      scrollIntoViewMock.mockClear();

      const newMessages = [
        ...messages,
        createMessage('2', 'assistant', 'Response'),
      ];

      rerender(
        <SettingsProvider>
          <MessageList
            messages={newMessages}
            isConfigured={true}
            onOpenJsonPanel={mockOnOpenJsonPanel}
          />
        </SettingsProvider>
      );

      // Should NOT auto-scroll since user scrolled up
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });

    it('resumes auto-scroll when user scrolls back to bottom', () => {
      const messages = [createMessage('1', 'user', 'Hello')];

      const { container, rerender } = render(
        <SettingsProvider>
          <MessageList
            messages={messages}
            isConfigured={true}
            onOpenJsonPanel={mockOnOpenJsonPanel}
          />
        </SettingsProvider>
      );

      // Simulate scrolling up first
      const messageList = container.querySelector('.message-list');
      if (messageList) {
        Object.defineProperty(messageList, 'scrollTop', { value: 0, writable: true });
        Object.defineProperty(messageList, 'scrollHeight', { value: 1000, writable: true });
        Object.defineProperty(messageList, 'clientHeight', { value: 400, writable: true });
        fireEvent.scroll(messageList);
      }

      scrollIntoViewMock.mockClear();

      // Simulate scrolling back to bottom
      if (messageList) {
        Object.defineProperty(messageList, 'scrollTop', { value: 600, writable: true });
        fireEvent.scroll(messageList);
      }

      const newMessages = [
        ...messages,
        createMessage('2', 'assistant', 'Response'),
      ];

      rerender(
        <SettingsProvider>
          <MessageList
            messages={newMessages}
            isConfigured={true}
            onOpenJsonPanel={mockOnOpenJsonPanel}
          />
        </SettingsProvider>
      );

      // Should auto-scroll since user is back at bottom
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
