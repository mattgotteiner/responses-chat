import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Message } from './Message';
import type { Message as MessageType } from '../../types';

describe('Message', () => {
  const baseMessage: MessageType = {
    id: 'msg-1',
    role: 'user',
    content: 'Hello world',
    timestamp: new Date(),
  };

  it('renders user message with You label', () => {
    render(<Message message={baseMessage} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders assistant message with Assistant label', () => {
    const assistantMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Hi there!',
    };
    render(<Message message={assistantMessage} />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('applies user class for user messages', () => {
    const { container } = render(<Message message={baseMessage} />);
    expect(container.querySelector('.message--user')).toBeInTheDocument();
  });

  it('applies assistant class for assistant messages', () => {
    const assistantMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
    };
    const { container } = render(<Message message={assistantMessage} />);
    expect(container.querySelector('.message--assistant')).toBeInTheDocument();
  });

  it('applies error class for error messages', () => {
    const errorMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      isError: true,
      content: 'Error occurred',
    };
    const { container } = render(<Message message={errorMessage} />);
    expect(container.querySelector('.message--error')).toBeInTheDocument();
  });

  it('shows thinking indicator when streaming with no content', () => {
    const streamingMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    render(<Message message={streamingMessage} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('shows cursor when streaming with content', () => {
    const streamingMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Partial response',
      isStreaming: true,
    };
    const { container } = render(<Message message={streamingMessage} />);
    expect(container.querySelector('.message__cursor')).toBeInTheDocument();
  });
});
