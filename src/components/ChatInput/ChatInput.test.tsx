import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatInput } from './ChatInput';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAudioInput } from '../../hooks/useAudioInput';
import { processAttachmentFiles } from '../../utils/attachment';
import type { Message } from '../../types';

vi.mock('../../hooks/useIsMobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('../../hooks/useAudioInput', () => ({
  useAudioInput: vi.fn(),
}));

vi.mock('../../utils/attachment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/attachment')>();
  return {
    ...actual,
    processAttachmentFiles: vi.fn(),
  };
});

describe('ChatInput', () => {
  const mockOnSendMessage = vi.fn();
  const mockOnClearConversation = vi.fn();
  const mockOnStopStreaming = vi.fn();
  const mockClipboardWriteText = vi.fn();
  const mockProcessAttachmentFiles = vi.mocked(processAttachmentFiles);
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
    mockProcessAttachmentFiles.mockReset();
    mockProcessAttachmentFiles.mockResolvedValue({ attachments: [], rejectedFiles: [] });
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

  it('renders textarea with default placeholder on desktop', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );
    expect(screen.getByPlaceholderText('Type a message... (Enter ↵ to send)')).toBeInTheDocument();
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

  it('shows keyboard hint in placeholder on desktop', () => {
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    expect(screen.getByPlaceholderText('Type a message... (Enter ↵ to send)')).toBeInTheDocument();
  });

  it('shows plain placeholder on mobile (no keyboard hint)', () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    render(
      <ChatInput
        onSendMessage={mockOnSendMessage}
        onClearConversation={mockOnClearConversation}
      />
    );

    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('does not send message on Enter key when on a touch device', () => {
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

  describe('desktop image paste', () => {
    const pastedAttachment = {
      id: 'attach-pasted',
      name: 'pasted-image.png',
      type: 'image' as const,
      mimeType: 'image/png',
      base64: 'abc123',
      previewUrl: 'data:image/png;base64,abc123',
      size: 1024,
    };

    function createClipboardFileItem(file: File) {
      return {
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      };
    }

    it('attaches pasted images on desktop and enables sending without text', async () => {
      mockProcessAttachmentFiles.mockResolvedValue({
        attachments: [pastedAttachment],
        rejectedFiles: [],
      });

      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const textarea = screen.getByLabelText('Message input');
      const imageFile = new File(['image-bytes'], 'pasted-image.png', { type: 'image/png' });

      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: {
            items: [createClipboardFileItem(imageFile)],
          },
        });
      });

      await vi.waitFor(() => {
        expect(mockProcessAttachmentFiles).toHaveBeenCalledTimes(1);
      });

      expect(await screen.findByRole('img', { name: 'pasted-image.png' })).toBeInTheDocument();
      expect(screen.getByLabelText('Send message')).not.toBeDisabled();
    });

    it('sends pasted images even when the text input is empty', async () => {
      mockProcessAttachmentFiles.mockResolvedValue({
        attachments: [pastedAttachment],
        rejectedFiles: [],
      });

      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const textarea = screen.getByLabelText('Message input');
      const imageFile = new File(['image-bytes'], 'pasted-image.png', { type: 'image/png' });

      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: {
            items: [createClipboardFileItem(imageFile)],
          },
        });
      });

      await vi.waitFor(() => {
        expect(screen.getByRole('img', { name: 'pasted-image.png' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('Send message'));

      expect(mockOnSendMessage).toHaveBeenCalledWith('', [pastedAttachment]);
    });

    it('ignores non-image clipboard items so normal paste behavior can continue', () => {
      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      fireEvent.paste(screen.getByLabelText('Message input'), {
        clipboardData: {
          items: [{
            kind: 'string',
            type: 'text/plain',
            getAsFile: () => null,
          }],
        },
      });

      expect(mockProcessAttachmentFiles).not.toHaveBeenCalled();
    });

    it('does not attach pasted images on mobile', async () => {
      vi.mocked(useIsMobile).mockReturnValue(true);

      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const imageFile = new File(['image-bytes'], 'pasted-image.png', { type: 'image/png' });

      await act(async () => {
        fireEvent.paste(screen.getByLabelText('Message input'), {
          clipboardData: {
            items: [createClipboardFileItem(imageFile)],
          },
        });
      });

      expect(mockProcessAttachmentFiles).not.toHaveBeenCalled();
    });

    it('shows paste validation feedback when a pasted image is rejected', async () => {
      mockProcessAttachmentFiles.mockResolvedValue({
        attachments: [],
        rejectedFiles: [
          {
            name: 'pasted-image.png',
            reason: 'file-too-large',
            message: '"pasted-image.png" is too large (15.0 MB). Maximum file size is 10.0 MB.',
          },
        ],
      });

      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const imageFile = new File(['image-bytes'], 'pasted-image.png', { type: 'image/png' });

      await act(async () => {
        fireEvent.paste(screen.getByLabelText('Message input'), {
          clipboardData: {
            items: [createClipboardFileItem(imageFile)],
          },
        });
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('Maximum file size is 10.0 MB.');
    });
  });

  describe('desktop image drag and drop', () => {
    const droppedAttachment = {
      id: 'attach-dropped',
      name: 'dropped-image.png',
      type: 'image' as const,
      mimeType: 'image/png',
      base64: 'drop123',
      previewUrl: 'data:image/png;base64,drop123',
      size: 1024,
    };

    function createFileDataTransfer(files: File[]) {
      return {
        files,
        types: ['Files'],
        dropEffect: 'copy',
      };
    }

    it('attaches dropped images and enables sending without text', async () => {
      mockProcessAttachmentFiles.mockResolvedValue({
        attachments: [droppedAttachment],
        rejectedFiles: [],
      });

      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const textarea = screen.getByLabelText('Message input');
      const container = textarea.closest('.chat-input');
      const imageFile = new File(['image-bytes'], 'dropped-image.png', { type: 'image/png' });

      expect(container).not.toHaveClass('chat-input--drag-over');

      fireEvent.dragEnter(container!, {
        dataTransfer: createFileDataTransfer([imageFile]),
      });

      expect(container).toHaveClass('chat-input--drag-over');

      await act(async () => {
        fireEvent.drop(container!, {
          dataTransfer: createFileDataTransfer([imageFile]),
        });
      });

      await vi.waitFor(() => {
        expect(mockProcessAttachmentFiles).toHaveBeenCalledTimes(1);
      });

      expect(mockProcessAttachmentFiles).toHaveBeenCalledWith([imageFile], {
        maxFileSize: 10 * 1024 * 1024,
        codeInterpreterEnabled: false,
      });
      expect(await screen.findByRole('img', { name: 'dropped-image.png' })).toBeInTheDocument();
      expect(screen.getByLabelText('Send message')).not.toBeDisabled();
      expect(container).not.toHaveClass('chat-input--drag-over');
    });

    it('ignores non-image file drops', async () => {
      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const textarea = screen.getByLabelText('Message input');
      const container = textarea.closest('.chat-input');
      const pdfFile = new File(['pdf-bytes'], 'document.pdf', { type: 'application/pdf' });

      fireEvent.dragEnter(container!, {
        dataTransfer: createFileDataTransfer([pdfFile]),
      });

      expect(container).not.toHaveClass('chat-input--drag-over');

      await act(async () => {
        fireEvent.drop(container!, {
          dataTransfer: createFileDataTransfer([pdfFile]),
        });
      });

      expect(mockProcessAttachmentFiles).not.toHaveBeenCalled();
      expect(screen.queryByRole('img', { name: 'document.pdf' })).not.toBeInTheDocument();
    });

    it('shows validation feedback when a dropped image is rejected', async () => {
      mockProcessAttachmentFiles.mockResolvedValue({
        attachments: [],
        rejectedFiles: [
          {
            name: 'dropped-image.png',
            reason: 'file-too-large',
            message: '"dropped-image.png" is too large (15.0 MB). Maximum file size is 10.0 MB.',
          },
        ],
      });

      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const textarea = screen.getByLabelText('Message input');
      const container = textarea.closest('.chat-input');
      const imageFile = new File(['image-bytes'], 'dropped-image.png', { type: 'image/png' });

      await act(async () => {
        fireEvent.drop(container!, {
          dataTransfer: createFileDataTransfer([imageFile]),
        });
      });

      expect(await screen.findByRole('alert')).toHaveTextContent('Maximum file size is 10.0 MB.');
    });

    it('clears the drag-over state when the dragged files leave the chat input', () => {
      render(
        <ChatInput
          onSendMessage={mockOnSendMessage}
          onClearConversation={mockOnClearConversation}
        />
      );

      const textarea = screen.getByLabelText('Message input');
      const container = textarea.closest('.chat-input');
      const imageFile = new File(['image-bytes'], 'dropped-image.png', { type: 'image/png' });

      fireEvent.dragEnter(container!, {
        dataTransfer: createFileDataTransfer([imageFile]),
      });

      expect(container).toHaveClass('chat-input--drag-over');

      fireEvent.dragLeave(container!, {
        dataTransfer: createFileDataTransfer([imageFile]),
        relatedTarget: document.body,
      });

      expect(container).not.toHaveClass('chat-input--drag-over');
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
