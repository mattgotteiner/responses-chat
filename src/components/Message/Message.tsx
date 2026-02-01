/**
 * Single message component
 */

import type { Message as MessageType } from '../../types';
import { ReasoningBox } from '../ReasoningBox';
import { ToolCallBox } from '../ToolCallBox';
import './Message.css';

interface MessageProps {
  /** Message data to display */
  message: MessageType;
}

/**
 * Renders a single chat message with appropriate styling based on role
 */
export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const hasReasoning = message.reasoning && message.reasoning.length > 0;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const showThinking = message.isStreaming && !message.content && !hasReasoning;

  return (
    <div
      className={`message ${isUser ? 'message--user' : 'message--assistant'} ${
        message.isError ? 'message--error' : ''
      }`}
    >
      <div className="message__role">{isUser ? 'You' : 'Assistant'}</div>
      <div className="message__content-wrapper">
        {/* Reasoning box (before content) */}
        {hasReasoning && (
          <ReasoningBox
            reasoning={message.reasoning!}
            isStreaming={message.isStreaming}
          />
        )}

        {/* Tool calls */}
        {hasToolCalls &&
          message.toolCalls!.map((toolCall) => (
            <ToolCallBox key={toolCall.id} toolCall={toolCall} />
          ))}

        {/* Main content or thinking indicator */}
        {showThinking ? (
          <div className="message__thinking">
            <span className="message__thinking-dot">●</span>
            <span className="message__thinking-dot">●</span>
            <span className="message__thinking-dot">●</span>
            Thinking...
          </div>
        ) : (
          <div className="message__content">{message.content}</div>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && message.content && (
          <span className="message__cursor">▌</span>
        )}
      </div>
    </div>
  );
}
