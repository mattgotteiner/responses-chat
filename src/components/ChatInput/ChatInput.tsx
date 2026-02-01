/**
 * Chat input component with textarea and send button
 */

import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import type { TokenUsage } from '../../types';
import { TokenUsageDisplay } from '../TokenUsageDisplay';
import './ChatInput.css';

interface ChatInputProps {
  /** Handler called when user sends a message */
  onSendMessage: (content: string) => void;
  /** Handler called when user wants to clear conversation */
  onClearConversation: () => void;
  /** Whether input should be disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Token usage for the conversation */
  tokenUsage?: TokenUsage;
}

/**
 * Text input area with send button for chat messages
 */
export function ChatInput({
  onSendMessage,
  onClearConversation,
  disabled = false,
  placeholder = 'Type a message...',
  tokenUsage,
}: ChatInputProps) {
  const [value, setValue] = useState('');

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSendMessage(value.trim());
      setValue('');
    }
  }, [value, disabled, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="chat-input">
      <div className="chat-input__container">
        <textarea
          className="chat-input__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label="Message input"
        />
        <button
          className="chat-input__send"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          title="Send message"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <div className="chat-input__actions">
        <div className="chat-input__actions-left">
          <button
            className="chat-input__clear"
            onClick={onClearConversation}
            disabled={disabled}
            title="Clear conversation"
          >
            Clear conversation
          </button>
          <TokenUsageDisplay usage={tokenUsage} mode="compact" />
        </div>
        <span className="chat-input__hint">
          Press Enter to send, Shift+Enter for new line
        </span>
      </div>
    </div>
  );
}
