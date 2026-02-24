/**
 * Chat input component with textarea and send button
 */

import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import type { Attachment, Message, TokenUsage } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { AttachmentButton } from '../AttachmentButton';
import { AttachmentPreview } from '../AttachmentPreview';
import { TokenUsageDisplay } from '../TokenUsageDisplay';
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
  /** Messages array for conversation JSON export */
  messages?: Message[];
  /** Whether code interpreter is enabled (affects allowed attachment types) */
  codeInterpreterEnabled?: boolean;
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
  placeholder,
  tokenUsage,
  messages = [],
  codeInterpreterEnabled = false,
}: ChatInputProps) {
  const isMobile = useIsMobile();
  const resolvedPlaceholder =
    placeholder ?? (isMobile ? 'Type a message...' : 'Type a message... (Enter ↵ to send)');
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSendMessage(value.trim(), attachments.length > 0 ? attachments : undefined);
      setValue('');
      setAttachments([]);
    }
  }, [value, disabled, onSendMessage, attachments]);

  const handleAttach = useCallback((newAttachments: Attachment[]) => {
    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (isMobile) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [isMobile, handleSend]
  );

  const handleCopyConversation = useCallback(async () => {
    if (messages.length > 0) {
      const conversationJson = messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        ...(m.reasoning && { reasoning: m.reasoning }),
        ...(m.toolCalls && { toolCalls: m.toolCalls }),
        ...(m.isError && { isError: m.isError }),
        ...(m.isStopped && { isStopped: m.isStopped }),
        ...(m.requestJson && { requestJson: m.requestJson }),
        ...(m.responseJson && { responseJson: m.responseJson }),
      }));
      try {
        await navigator.clipboard.writeText(JSON.stringify(conversationJson, null, 2));
      } catch {
        // Clipboard write failed silently
      }
    }
  }, [messages]);

  return (
    <div className="chat-input">
      {attachments.length > 0 && (
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />
      )}
      <div className="chat-input__container">
        <textarea
          className="chat-input__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          disabled={disabled}
          rows={1}
          aria-label="Message input"
        />
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
        )}
        <AttachmentButton onAttach={handleAttach} disabled={disabled} codeInterpreterEnabled={codeInterpreterEnabled} />
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
          {messages.length > 0 && (
            <button
              className="chat-input__copy-json"
              onClick={handleCopyConversation}
              title="Copy conversation as JSON"
            >
              <span className="chat-input__copy-json-icon">📋</span>
              <span>Copy JSON</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
