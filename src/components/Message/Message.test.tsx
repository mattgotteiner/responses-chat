import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Message } from './Message';
import type { Message as MessageType } from '../../types';
import { SettingsProvider } from '../../context/SettingsContext';
import type { ReactElement } from 'react';

/**
 * Helper to render components with SettingsProvider
 */
function renderWithSettings(ui: ReactElement) {
  return render(
    <SettingsProvider>{ui}</SettingsProvider>
  );
}

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
    renderWithSettings(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders assistant message with Assistant label', () => {
    const assistantMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Hi there!',
    };
    renderWithSettings(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('Assistant')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('applies user class for user messages', () => {
    const { container } = renderWithSettings(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message--user')).toBeInTheDocument();
  });

  it('applies assistant class for assistant messages', () => {
    const assistantMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
    };
    const { container } = renderWithSettings(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message--assistant')).toBeInTheDocument();
  });

  it('applies error class for error messages', () => {
    const errorMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      isError: true,
      content: 'Error occurred',
    };
    const { container } = renderWithSettings(<Message message={errorMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message--error')).toBeInTheDocument();
  });

  it('shows thinking indicator when streaming with no content', () => {
    const streamingMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    renderWithSettings(<Message message={streamingMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('shows cursor when streaming with content', () => {
    const streamingMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Partial response',
      isStreaming: true,
    };
    const { container } = renderWithSettings(<Message message={streamingMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(container.querySelector('.message__cursor')).toBeInTheDocument();
  });

  it('shows JSON button when user message has requestJson', () => {
    const messageWithJson: MessageType = {
      ...baseMessage,
      requestJson: { model: 'gpt-5', input: 'Hello' },
    };
    renderWithSettings(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByLabelText('View JSON')).toBeInTheDocument();
  });

  it('shows JSON button when assistant message has responseJson', () => {
    const messageWithJson: MessageType = {
      ...baseMessage,
      role: 'assistant',
      responseJson: { id: 'resp-1', output: [{ text: 'Hi' }] },
    };
    renderWithSettings(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByLabelText('View JSON')).toBeInTheDocument();
  });

  it('does not show JSON button when no JSON data', () => {
    renderWithSettings(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.queryByLabelText('View JSON')).not.toBeInTheDocument();
  });

  it('calls onOpenJsonPanel with request data when user message button clicked', () => {
    const requestData = { model: 'gpt-5', input: 'Hello' };
    const messageWithJson: MessageType = {
      ...baseMessage,
      requestJson: requestData,
    };
    renderWithSettings(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    
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
    renderWithSettings(<Message message={messageWithJson} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    
    fireEvent.click(screen.getByLabelText('View JSON'));
    
    expect(mockOnOpenJsonPanel).toHaveBeenCalledWith({
      title: 'Response JSON',
      data: responseData,
    });
  });

  it('shows cancelled indicator inline when message isStopped with content', () => {
    const stoppedMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Partial response',
      isStopped: true,
    };
    renderWithSettings(<Message message={stoppedMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('cancelled')).toBeInTheDocument();
    expect(screen.getByText('Partial response')).toBeInTheDocument();
  });

  it('shows cancelled indicator standalone when message isStopped with no content', () => {
    const stoppedMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: '',
      isStopped: true,
    };
    const { container } = renderWithSettings(<Message message={stoppedMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.getByText('cancelled')).toBeInTheDocument();
    expect(container.querySelector('.message__cancelled--standalone')).toBeInTheDocument();
  });

  it('does not show cancelled indicator when message isStopped is false', () => {
    const normalMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Complete response',
      isStopped: false,
    };
    renderWithSettings(<Message message={normalMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.queryByText('cancelled')).not.toBeInTheDocument();
  });

  it('does not show cancelled indicator when isStopped is undefined', () => {
    const normalMessage: MessageType = {
      ...baseMessage,
      role: 'assistant',
      content: 'Complete response',
    };
    renderWithSettings(<Message message={normalMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
    expect(screen.queryByText('cancelled')).not.toBeInTheDocument();
  });

describe('citations', () => {
    it('renders citations when present and not streaming', () => {
      const messageWithCitations: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Here is some information from the web.',
        citations: [
          {
            url: 'https://example.com/article1',
            title: 'Example Article 1',
            startIndex: 0,
            endIndex: 10,
          },
          {
            url: 'https://example.com/article2',
            title: 'Example Article 2',
            startIndex: 11,
            endIndex: 20,
          },
        ],
      };
      renderWithSettings(<Message message={messageWithCitations} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      expect(screen.getByText('Sources')).toBeInTheDocument();
      expect(screen.getByText('Example Article 1')).toBeInTheDocument();
      expect(screen.getByText('Example Article 2')).toBeInTheDocument();
    });

    it('renders citation links with correct href', () => {
      const messageWithCitations: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Web content',
        citations: [
          {
            url: 'https://example.com/test',
            title: 'Test Link',
            startIndex: 0,
            endIndex: 5,
          },
        ],
      };
      renderWithSettings(<Message message={messageWithCitations} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      const link = screen.getByRole('link', { name: 'Test Link' });
      expect(link).toHaveAttribute('href', 'https://example.com/test');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not render citations while streaming', () => {
      const streamingWithCitations: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Partial content',
        isStreaming: true,
        citations: [
          {
            url: 'https://example.com/test',
            title: 'Test Link',
            startIndex: 0,
            endIndex: 5,
          },
        ],
      };
      renderWithSettings(<Message message={streamingWithCitations} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    });

    it('does not render citations section when citations array is empty', () => {
      const messageWithEmptyCitations: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Response without citations',
        citations: [],
      };
      renderWithSettings(<Message message={messageWithEmptyCitations} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    });

    it('uses URL as link text when title is empty', () => {
      const messageWithNoTitle: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Content',
        citations: [
          {
            url: 'https://example.com/no-title',
            title: '',
            startIndex: 0,
            endIndex: 5,
          },
        ],
      };
      renderWithSettings(<Message message={messageWithNoTitle} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      expect(screen.getByText('https://example.com/no-title')).toBeInTheDocument();
    });
  });

  describe('render mode toggle', () => {
    it('shows render mode toggle for assistant messages', () => {
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Hello',
      };
      renderWithSettings(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      
      expect(screen.getByTitle('Rendered Markdown')).toBeInTheDocument();
      expect(screen.getByTitle('Plain Text')).toBeInTheDocument();
      expect(screen.getByTitle('Code Block')).toBeInTheDocument();
    });

    it('does not show render mode toggle for user messages', () => {
      renderWithSettings(<Message message={baseMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      
      expect(screen.queryByTitle('Rendered Markdown')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Plain Text')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Code Block')).not.toBeInTheDocument();
    });

    it('does not show render mode toggle for error messages', () => {
      const errorMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Error occurred',
        isError: true,
      };
      renderWithSettings(<Message message={errorMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      
      expect(screen.queryByTitle('Rendered Markdown')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Plain Text')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Code Block')).not.toBeInTheDocument();
    });

    it('switches to plaintext mode when toggle clicked', async () => {
      const user = userEvent.setup();
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: '**bold text**',
      };
      const { container } = renderWithSettings(
        <Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />
      );
      
      // Click plain text mode
      await user.click(screen.getByTitle('Plain Text'));
      
      // Should apply plaintext class
      expect(container.querySelector('.message-content--plaintext')).toBeInTheDocument();
      // Should show raw markdown syntax
      expect(screen.getByText(/\*\*bold text\*\*/)).toBeInTheDocument();
    });

    it('switches to code mode when toggle clicked', async () => {
      const user = userEvent.setup();
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Some code content',
      };
      const { container } = renderWithSettings(
        <Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />
      );
      
      // Click code block mode
      await user.click(screen.getByTitle('Code Block'));
      
      // Should apply code class and render in pre/code
      expect(container.querySelector('.message-content--code')).toBeInTheDocument();
      expect(container.querySelector('pre')).toBeInTheDocument();
      expect(container.querySelector('code')).toBeInTheDocument();
    });

    it('shows reset button when override is active', async () => {
      const user = userEvent.setup();
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Hello',
      };
      renderWithSettings(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      
      // Initially no reset button
      expect(screen.queryByTitle('Reset to global setting')).not.toBeInTheDocument();
      
      // Click a different mode to create override
      await user.click(screen.getByTitle('Plain Text'));
      
      // Reset button should appear
      expect(screen.getByTitle('Reset to global setting')).toBeInTheDocument();
    });

    it('does not show reset button when clicking the same mode as global', async () => {
      const user = userEvent.setup();
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: 'Hello',
      };
      renderWithSettings(<Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />);
      
      // Click the same mode as global (markdown is default)
      await user.click(screen.getByTitle('Rendered Markdown'));
      
      // Reset button should NOT appear since we picked the global setting
      expect(screen.queryByTitle('Reset to global setting')).not.toBeInTheDocument();
    });

    it('resets to global setting when reset button clicked', async () => {
      const user = userEvent.setup();
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: '**bold**',
      };
      const { container } = renderWithSettings(
        <Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />
      );
      
      // Click plaintext mode
      await user.click(screen.getByTitle('Plain Text'));
      expect(container.querySelector('.message-content--plaintext')).toBeInTheDocument();
      
      // Click reset
      await user.click(screen.getByTitle('Reset to global setting'));
      
      // Should be back to markdown (default global setting)
      expect(container.querySelector('.message-content--markdown')).toBeInTheDocument();
      // Reset button should disappear
      expect(screen.queryByTitle('Reset to global setting')).not.toBeInTheDocument();
    });

    it('defaults to markdown rendering for assistant messages', () => {
      const assistantMessage: MessageType = {
        ...baseMessage,
        role: 'assistant',
        content: '**bold** and *italic*',
      };
      const { container } = renderWithSettings(
        <Message message={assistantMessage} onOpenJsonPanel={mockOnOpenJsonPanel} />
      );
      
      // Should use markdown rendering by default
      expect(container.querySelector('.message-content--markdown')).toBeInTheDocument();
      // Bold text should be in a strong tag
      expect(screen.getByText('bold').tagName.toLowerCase()).toBe('strong');
    });
  });
});
