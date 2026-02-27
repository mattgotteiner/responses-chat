/**
 * Chat input component with textarea and send button
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import type { Attachment, Message, TokenUsage } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAudioInput } from '../../hooks/useAudioInput';
import { AttachmentButton } from '../AttachmentButton';
import { AttachmentPreview } from '../AttachmentPreview';
import { TokenUsageDisplay } from '../TokenUsageDisplay';
import { AudioInputButton } from '../AudioInputButton';
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
  const { isSupported: isAudioSupported, isRecording, start: startRecording, stop: stopRecording } = useAudioInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isRecording && textareaRef.current) {
      const el = textareaRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [value, isRecording]);

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      if (isRecording) {
        stopRecording();
      }
      onSendMessage(value.trim(), attachments.length > 0 ? attachments : undefined);
      setValue('');
      setAttachments([]);
    }
  }, [value, disabled, onSendMessage, attachments, isRecording, stopRecording]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(value, (transcript) => setValue(transcript));
    }
  }, [isRecording, stopRecording, startRecording, value]);

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
          ref={textareaRef}
          className="chat-input__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          disabled={disabled || isRecording}
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
        <AudioInputButton
          isSupported={isAudioSupported}
          isRecording={isRecording}
          disabled={disabled}
          onClick={handleToggleRecording}
        />
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
          <a
            href="https://github.com/mattgotteiner/responses-chat"
            target="_blank"
            rel="noopener noreferrer"
            className="chat-input__github-link"
            aria-label="View on GitHub"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
