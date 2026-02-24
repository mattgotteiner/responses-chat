import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './ChatInput';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAudioInput } from '../../hooks/useAudioInput';
import type { Message } from '../../types';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('../../hooks/useAudioInput', () => ({
  useAudioInput: vi.fn(),
}));

describe('ChatInput', () => {
  const mockOnSendMessage = vi.fn();
  const mockOnClearConversation = vi.fn();
  const mockOnStopStreaming = vi.fn();
  const mockClipboardWriteText = vi.fn();
  const mockAudioStart = vi.fn();
  const mockAudioStop = vi.fn();
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    vi.mocked(useAudioInput).mockReturnValue({
      isSupported: true,
      isRecording: false,
      error: null,
      start: mockAudioStart,
      stop: mockAudioStop,
    });
    mockOnSendMessage.mockClear();
    mockOnClearConversation.mockClear();
    mockOnStopStreaming.mockClear();
    mockAudioStart.mockClear();
    mockAudioStop.mockClear();
    mockClipboardWriteText.mockClear().mockResolvedValue(undefined);
    originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockClipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    }
  });

  it('renders textarea with default placeholder', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('renders textarea with custom placeholder', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
        placeholder="Custom placeholder"
      />
    );
    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('shows send button when not streaming', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
        isStreaming={false}
      />
    );
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop generation')).not.toBeInTheDocument();
  });

  it('shows stop button when streaming', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
        onStopStreaming={mockOnStopStreaming}
        isStreaming={true}
      />
    );
    expect(screen.getByLabelText('Stop generation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Send message')).not.toBeInTheDocument();
  });

  it('calls onStopStreaming when stop button is clicked', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
        onStopStreaming={mockOnStopStreaming}
        isStreaming={true}
      />
    );

    fireEvent.click(screen.getByLabelText('Stop generation'));
    expect(mockOnStopStreaming).toHaveBeenCalledTimes(1);
  });

  it('calls onSendMessage when send button is clicked with input', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello', undefined);
  });

  it('clears input after sending message', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(textarea.value).toBe('');
  });

  it('does not send empty message', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    fireEvent.click(screen.getByLabelText('Send message'));
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only message', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('sends message on Enter key press', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello', undefined);
  });

  it('does not send message on Shift+Enter', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('calls onClearConversation when clear button is clicked', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    fireEvent.click(screen.getByText('Clear conversation'));
    expect(mockOnClearConversation).toHaveBeenCalledTimes(1);
  });

  it('disables textarea when disabled prop is true', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
        disabled={true}
      />
    );

    expect(screen.getByLabelText('Message input')).toBeDisabled();
  });

  it('disables send button when disabled', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
        disabled={true}
      />
    );

    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('disables send button when input is empty', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    expect(screen.getByLabelText('Send message')).toBeDisabled();
  });

  it('enables send button when input has content', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });

    expect(screen.getByLabelText('Send message')).not.toBeDisabled();
  });

  it('shows keyboard hint', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    expect(screen.getByText('Press Enter to send, Shift+Enter for new line')).toBeInTheDocument();
  });

  it('shows mobile hint on mobile', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    expect(screen.getByText('Tap ↑ to send')).toBeInTheDocument();
    expect(screen.queryByText('Press Enter to send, Shift+Enter for new line')).not.toBeInTheDocument();
  });

  it('does not send message on Enter key when on mobile', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    const textarea = screen.getByLabelText('Message input');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  describe('copy conversation JSON button', () => {
    const sampleMessages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date('2026-01-15T10:00:00Z'),
        requestJson: { model: 'gpt-5', input: 'Hello' },
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: new Date('2026-01-15T10:00:01Z'),
        responseJson: { id: 'resp-1', output: [{ text: 'Hi there!' }] },
      },
    ];

    it('does not show copy JSON button when no messages', () => {
      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
          messages={[]}
        />
      );

      expect(screen.queryByTitle('Copy conversation as JSON')).not.toBeInTheDocument();
    });

    it('shows copy JSON button when messages exist', () => {
      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
          messages={sampleMessages}
        />
      );

      expect(screen.getByTitle('Copy conversation as JSON')).toBeInTheDocument();
      expect(screen.getByText('Copy JSON')).toBeInTheDocument();
    });

    it('copies conversation JSON when button clicked', async () => {
      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
          messages={sampleMessages}
        />
      );

      const copyButton = screen.getByTitle('Copy conversation as JSON');
      expect(copyButton).toHaveTextContent('Copy JSON');

      fireEvent.click(copyButton);

      await vi.waitFor(() => {
        expect(mockClipboardWriteText).toHaveBeenCalledWith(
          JSON.stringify([
            {
              role: 'user',
              content: 'Hello',
              timestamp: '2026-01-15T10:00:00.000Z',
              requestJson: { model: 'gpt-5', input: 'Hello' },
            },
            {
              role: 'assistant',
              content: 'Hi there!',
              timestamp: '2026-01-15T10:00:01.000Z',
              responseJson: { id: 'resp-1', output: [{ text: 'Hi there!' }] },
            },
          ], null, 2)
        );
      });
    });
  });

  describe('voice input', () => {
    it('shows voice input button when audio is supported', () => {
      render(
        <ChatInput onSendMessage={mockOnSendMessage} onClearConversation={mockOnClearConversation} />,
      );
      expect(screen.getByLabelText('Start voice input')).toBeInTheDocument();
    });

    it('does not show voice input button when audio is not supported', () => {
      vi.mocked(useAudioInput).mockReturnValueOnce({
        isSupported: false,
        isRecording: false,
        error: null,
        start: mockAudioStart,
        stop: mockAudioStop,
      });
      render(
        <ChatInput onSendMessage={mockOnSendMessage} onClearConversation={mockOnClearConversation} />,
      );
      expect(screen.queryByLabelText('Start voice input')).not.toBeInTheDocument();
    });

    it('calls start with current input value when mic button is clicked', () => {
      render(
        <ChatInput onSendMessage={mockOnSendMessage} onClearConversation={mockOnClearConversation} />,
      );
      const textarea = screen.getByLabelText('Message input');
      fireEvent.change(textarea, { target: { value: 'hello' } });
      fireEvent.click(screen.getByLabelText('Start voice input'));
      expect(mockAudioStart).toHaveBeenCalledWith('hello', expect.any(Function));
    });

    it('calls stop when mic button is clicked while recording', () => {
      vi.mocked(useAudioInput).mockReturnValueOnce({
        isSupported: true,
        isRecording: true,
        error: null,
        start: mockAudioStart,
        stop: mockAudioStop,
      });
      render(
        <ChatInput onSendMessage={mockOnSendMessage} onClearConversation={mockOnClearConversation} />,
      );
      fireEvent.click(screen.getByLabelText('Stop voice input'));
      expect(mockAudioStop).toHaveBeenCalledTimes(1);
    });

    it('disables textarea while recording to prevent overwrites', () => {
      vi.mocked(useAudioInput).mockReturnValue({
        isSupported: true,
        isRecording: true,
        error: null,
        start: mockAudioStart,
        stop: mockAudioStop,
      });
      render(
        <ChatInput onSendMessage={mockOnSendMessage} onClearConversation={mockOnClearConversation} />,
      );
      expect(screen.getByLabelText('Message input')).toBeDisabled();
    });

    it('stops recording when message is sent while recording', () => {
      // Use mockReturnValue (not Once) so all re-renders from state changes still see isRecording:true
      vi.mocked(useAudioInput).mockReturnValue({
        isSupported: true,
        isRecording: true,
        error: null,
        start: mockAudioStart,
        stop: mockAudioStop,
      });
      render(
        <ChatInput onSendMessage={mockOnSendMessage} onClearConversation={mockOnClearConversation} />,
      );
      const textarea = screen.getByLabelText('Message input');
      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      fireEvent.click(screen.getByLabelText('Send message'));
      expect(mockAudioStop).toHaveBeenCalledTimes(1);
      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello world', undefined);
    });
  });
});
