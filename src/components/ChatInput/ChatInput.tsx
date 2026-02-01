/**
 * Chat input component with textarea and send button
 */

import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import type { Attachment, TokenUsage } from '../../types';
import { TokenUsageDisplay } from '../TokenUsageDisplay';
import { AttachmentButton } from '../AttachmentButton';
import { AttachmentPreview } from '../AttachmentPreview';
import './ChatInput.css';

interface ChatInputProps {
  /** Handler called when user sends a message */
  onSendMessage: (content: string, attachments?: Attachment[]) => void;
  /** Handler called when user wants to clear conversation */
  onClearConversation: () => void;
  /** Handler called when user wants to stop streaming */
  onStopStreaming?: () => void;
  /** Whether a response is currently streaming */
  isStreaming?: boolean;
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
  onStopStreaming,
  isStreaming = false,
  disabled = false,
  placeholder = 'Type a message...',
  tokenUsage,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleAttach = useCallback((newAttachments: Attachment[]) => {
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const canSend = (value.trim() || attachments.length > 0) && !disabled;

  const handleSend = useCallback(() => {
    if (canSend) {
      onSendMessage(value.trim(), attachments.length > 0 ? attachments : undefined);
      setValue('');
      setAttachments([]);
    }
  }, [value, attachments, canSend, onSendMessage]);

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
      {/* Attachment preview */}
      <AttachmentPreview
        attachments={attachments}
        onRemove={handleRemoveAttachment}
        disabled={disabled}
      />
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
        <AttachmentButton onAttach={handleAttach} disabled={disabled} />
        {isStreaming ? (
          <button
            className="chat-input__stop"
            onClick={onStopStreaming}
            aria-label="Stop generation"
            title="Stop generation"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            className="chat-input__send"
            onClick={handleSend}
            disabled={!canSend}
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
        )}
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
