import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  const mockOnSendMessage = vi.fn();
  const mockOnClearConversation = vi.fn();
  const mockOnStopStreaming = vi.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
    mockOnClearConversation.mockClear();
    mockOnStopStreaming.mockClear();
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

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello');
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

    expect(mockOnSendMessage).toHaveBeenCalledWith('Hello');
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
});
