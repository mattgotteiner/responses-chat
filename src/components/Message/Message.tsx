/**
 * Single message component
 */

import { useCallback } from 'react';
import type { Message as MessageType } from '../../types';
import type { JsonPanelData } from '../JsonSidePanel';
import { ReasoningBox } from '../ReasoningBox';
import { ToolCallBox } from '../ToolCallBox';
import './Message.css';

interface MessageProps {
  /** Message data to display */
  message: MessageType;
  /** Handler to open JSON panel */
  onOpenJsonPanel: (data: JsonPanelData) => void;
}

/**
 * Renders a single chat message with appropriate styling based on role
 */
export function Message({ message, onOpenJsonPanel }: MessageProps) {
  const isUser = message.role === 'user';
  const hasReasoning = message.reasoning && message.reasoning.length > 0;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasCitations = message.citations && message.citations.length > 0;
  const showThinking = message.isStreaming && !message.content && !hasReasoning;
  
  // Determine if JSON data is available
  const jsonData = isUser ? message.requestJson : message.responseJson;
  const hasJsonData = !!jsonData;

  const handleJsonClick = useCallback(() => {
    if (jsonData) {
      onOpenJsonPanel({
        title: isUser ? 'Request JSON' : 'Response JSON',
        data: jsonData,
      });
    }
  }, [jsonData, isUser, onOpenJsonPanel]);

  return (
    <div
      className={`message ${isUser ? 'message--user' : 'message--assistant'} ${
        message.isError ? 'message--error' : ''
      }`}
    >
      <div className="message__header">
        <span className="message__role">{isUser ? 'You' : 'Assistant'}</span>
        {hasJsonData && (
          <button
            className="message__json-button"
            onClick={handleJsonClick}
            aria-label="View JSON"
            title={isUser ? 'View request JSON' : 'View response JSON'}
          >
            {'{ }'}
          </button>
        )}
      </div>
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
          <div className="message__content">
            {message.content}
            {/* Cancelled indicator - inline when there's content */}
            {message.isStopped && message.content && (
              <span className="message__cancelled"> cancelled</span>
            )}
          </div>
        )}

        {/* Cancelled indicator - standalone when no content */}
        {message.isStopped && !message.content && (
          <div className="message__cancelled message__cancelled--standalone">cancelled</div>
        )}

        {/* Streaming cursor */}
        {message.isStreaming && message.content && (
          <span className="message__cursor">▌</span>
        )}

        {/* Citations from web search */}
        {hasCitations && !message.isStreaming && (
          <div className="message__citations">
            <div className="message__citations-header">Sources</div>
            <ul className="message__citations-list">
              {message.citations!.map((citation, index) => (
                <li key={`${citation.url}-${index}`} className="message__citation">
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="message__citation-link"
                    title={citation.url}
                  >
                    {citation.title || citation.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
