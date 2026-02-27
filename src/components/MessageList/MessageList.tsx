/**
 * Scrollable message list component
 */

import { useEffect, useRef, useCallback } from 'react';
import type { Message as MessageType } from '../../types';
import type { JsonPanelData } from '../JsonSidePanel';
import { Message } from '../Message';
import './MessageList.css';

interface MessageListProps {
  /** Messages to display */
  messages: MessageType[];
  /** Whether settings are configured */
  isConfigured: boolean;
  /** Handler to open JSON panel */
  onOpenJsonPanel: (data: JsonPanelData) => void;
  /** Handler when user approves an MCP tool call */
  onMcpApprove?: (approvalRequestId: string) => void;
  /** Handler when user denies an MCP tool call */
  onMcpDeny?: (approvalRequestId: string) => void;
  /** Handler when user retries a failed message */
  onRetry?: (messageId: string) => void;
  /** Whether a message is currently streaming — passed to each Message to disable retry */
  isStreaming?: boolean;
}

/** Threshold in pixels for considering user "at bottom" */
const SCROLL_THRESHOLD = 100;

/**
 * Scrollable container that displays all messages and auto-scrolls to bottom
 * only when user is already near the bottom (respects manual scrolling)
 */
export function MessageList({
  messages,
  isConfigured,
  onOpenJsonPanel,
  onMcpApprove,
  onMcpDeny,
  onRetry,
  isStreaming,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const checkIfNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
  }, []);

  const handleScroll = useCallback(() => {
    isNearBottomRef.current = checkIfNearBottom();
  }, [checkIfNearBottom]);

  // Auto-scroll to bottom only when user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      // Use instant scroll when loading a batch of messages (thread restore),
      // smooth scroll when a single new message arrives during a conversation.
      const wasEmpty = prevMessageCountRef.current === 0;
      bottomRef.current?.scrollIntoView({ behavior: wasEmpty && messages.length > 1 ? 'instant' : 'smooth' });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <div className="message-list__empty-state">
          {isConfigured ? (
            <>
              <div className="message-list__empty-icon">💬</div>
              <p className="message-list__empty-text">
                Start a conversation by typing a message below
              </p>
            </>
          ) : (
            <>
              <div className="message-list__empty-icon">⚙️</div>
              <p className="message-list__empty-text">
                Configure your Azure OpenAI settings to get started
              </p>
              <p className="message-list__empty-hint">
                Click the gear icon in the header
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="message-list" ref={containerRef} onScroll={handleScroll}>
      <div className="message-list__content">
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onOpenJsonPanel={onOpenJsonPanel}
            onMcpApprove={onMcpApprove}
            onMcpDeny={onMcpDeny}
            onRetry={onRetry}
            isStreaming={isStreaming}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
