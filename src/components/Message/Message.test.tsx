import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Message } from './Message';
import type { Message as MessageType } from '../../types';

describe('Message', () => {
  const mockOnOpenJsonPanel = vi.fn();
  
  const baseMessage: MessageType = {
    id: 'msg-1',
    role: 'user',
    content: 'Hello world',
    timestamp: new Date(),
  };

  beforeEach(() => {
    mockOnOpenJsonPanel.mockClear();
  });

  it('renders user message with You label', () => {
    render(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders assistant message with Assistant label', () => {
    const assistantMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Hi there!',
    };
    render(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('applies user class for user messages', () => {
    const { container } = render(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message--user')).toBeInTheDocument();
  });

  it('applies assistant class for assistant messages', () => {
    const assistantMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
    };
    const { container } = render(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message--assistant')).toBeInTheDocument();
  });

  it('applies error class for error messages', () => {
    const errorMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      isError: true,
      content: 'Error occurred',
    };
    const { container } = render(<Message message={errorMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message--error')).toBeInTheDocument();
  });

  it('shows thinking indicator when streaming with no content', () => {
    const streamingMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    render(<Message message={streamingMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('shows cursor when streaming with content', () => {
    const streamingMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Partial response',
      isStreaming: true,
    };
    const { container } = render(<Message message={streamingMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message__cursor')).toBeInTheDocument();
  });

  it('shows JSON button when user message has requestJson', () => {
    const messageWithJson: MessageType = {
      ...baseMessage,
      requestJson: { model: 'gpt-5', input: 'Hello' },
    };
    render(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByLabelText('View JSON')).toBeInTheDocument();
  });

  it('shows JSON button when assistant message has responseJson', () => {
    const messageWithJson: MessageType = {
      ...baseMessage,
      role: 'assistant',
      responseJson: { id: 'resp-1', output: [{ text: 'Hi' }] },
    };
    render(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByLabelText('View JSON')).toBeInTheDocument();
  });

  it('does not show JSON button when no JSON data', () => {
    render(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.queryByLabelText('View JSON')).not.toBeInTheDocument();
  });

  it('calls onOpenJsonPanel with request data when user message button clicked', () => {
    const requestData = { model: 'gpt-5', input: 'Hello' };
    const messageWithJson: MessageType = {
      ...baseMessage,
      requestJson: requestData,
    };
    render(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    
    fireEvent.click(screen.getByLabelText('View JSON'));
    
    expect(mockOnOpenJsonPanel).toHaveBeenCalledWith({
      title: 'Request JSON',
      data: requestData,
    });
  });

  it('calls onOpenJsonPanel with response data when assistant message button clicked', () => {
    const responseData = { id: 'resp-1', output: [{ text: 'Hi' }] };
    const messageWithJson: MessageType = {
      ...baseMessage,
      role: 'assistant',
      responseJson: responseData,
    };
    render(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    
    fireEvent.click(screen.getByLabelText('View JSON'));
    
    expect(mockOnOpenJsonPanel).toHaveBeenCalledWith({
      title: 'Response JSON',
      data: responseData,
    });
  });
});
