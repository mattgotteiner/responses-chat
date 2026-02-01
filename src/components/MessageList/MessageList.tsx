/**
 * Scrollable message list component
 */

import { useEffect, useRef } from 'react';
import type { Message as MessageType } from '../../types';
import { Message } from '../Message';
import './MessageList.css';

interface MessageListProps {
  /** Messages to display */
  messages: MessageType[];
  /** Whether settings are configured */
  isConfigured: boolean;
}

/**
 * Scrollable container that displays all messages and auto-scrolls to bottom
 */
export function MessageList({
  messages,
  isConfigured,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="message-list">
      <div className="message-list__content">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
