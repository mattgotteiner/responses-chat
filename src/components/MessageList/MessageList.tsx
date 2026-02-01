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
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

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
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
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
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
