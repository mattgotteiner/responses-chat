/**
 * Single message component
 */

import { useCallback, useState } from 'react';
import type { Message as MessageType, MessageRenderMode, Attachment } from '../../types';
import type { JsonPanelData } from '../JsonSidePanel';
import { ReasoningBox } from '../ReasoningBox';
import { ToolCallBox } from '../ToolCallBox';
import { MessageContent } from './MessageContent';
import { useSettingsContext } from '../../context/SettingsContext';
import { isImageAttachment } from '../../utils/attachment';
import './Message.css';

interface MessageProps {
  /** Message data to display */
  message: MessageType;
  /** Handler to open JSON panel */
  onOpenJsonPanel: (data: JsonPanelData) => void;
}

interface RenderModeToggleProps {
  /** Current effective render mode */
  currentMode: MessageRenderMode;
  /** Handler when mode changes */
  onModeChange: (mode: MessageRenderMode | null) => void;
  /** Whether a per-message override is active */
  hasOverride: boolean;
}

/**
 * Renders attachment thumbnails in a message
 */
function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="message__attachments">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="message__attachment">
          {isImageAttachment(attachment) && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="message__attachment-image"
            />
          ) : (
            <div className="message__attachment-file">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="message__attachment-file-icon"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="message__attachment-filename" title={attachment.name}>
                {attachment.name}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Toggle buttons for render mode selection
 */
function RenderModeToggle({ currentMode, onModeChange, hasOverride }: RenderModeToggleProps) {
  const modes: { mode: MessageRenderMode; label: string; title: string }[] = [
    { mode: 'markdown', label: 'MD', title: 'Rendered Markdown' },
    { mode: 'plaintext', label: 'TXT', title: 'Plain Text' },
    { mode: 'code', label: '</>', title: 'Code Block' },
  ];

  return (
    <div className="message__render-toggle">
      {modes.map(({ mode, label, title }) => (
        <button
          key={mode}
          className={`message__render-toggle-btn ${currentMode === mode ? 'message__render-toggle-btn--active' : ''}`}
          onClick={() => onModeChange(mode)}
          title={title}
          aria-label={title}
          aria-pressed={currentMode === mode}
        >
          {label}
        </button>
      ))}
      {hasOverride && (
        <button
          className="message__render-toggle-reset"
          onClick={() => onModeChange(null)}
          title="Reset to global setting"
          aria-label="Reset to global setting"
        >
          ↺
        </button>
      )}
    </div>
  );
}

/**
 * Renders a single chat message with appropriate styling based on role
 */
export function Message({ message, onOpenJsonPanel }: MessageProps) {
  const { settings } = useSettingsContext();
  const [overrideRenderMode, setOverrideRenderMode] = useState<MessageRenderMode | null>(null);
  
  const isUser = message.role === 'user';
  const hasReasoning = message.reasoning && message.reasoning.length > 0;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasCitations = message.citations && message.citations.length > 0;
  const hasAttachments = message.attachments && message.attachments.length > 0;
  const showThinking = message.isStreaming && !message.content && !hasReasoning;
  
  // Effective render mode: per-message override > global setting > default
  const globalRenderMode = settings.messageRenderMode ?? 'markdown';
  const effectiveRenderMode = overrideRenderMode ?? globalRenderMode;
  
  // Only show reset button if override differs from global
  const hasOverride = overrideRenderMode !== null && overrideRenderMode !== globalRenderMode;
  
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

  const handleRenderModeChange = useCallback((mode: MessageRenderMode | null) => {
    setOverrideRenderMode(mode);
  }, []);

  const handleCopyContent = useCallback(async () => {
    if (message.content) {
      try {
        await navigator.clipboard.writeText(message.content);
      } catch {
        // Clipboard write failed silently
      }
    }
  }, [message.content]);

  return (
    <div
      className={`message ${isUser ? 'message--user' : 'message--assistant'} ${
        message.isError ? 'message--error' : ''
      }`}
    >
      <div className="message__header">
        <span className="message__role">{isUser ? 'You' : 'Assistant'}</span>
        <div className="message__header-actions">
          {/* Render mode toggle - only for assistant messages, not errors */}
          {!isUser && !message.isError && (
            <RenderModeToggle
              currentMode={effectiveRenderMode}
              onModeChange={handleRenderModeChange}
              hasOverride={hasOverride}
            />
          )}
          {/* JSON and Copy buttons - always render both for assistant to avoid layout shift */}
          {!isUser && !message.isError && (
            <>
              <button
                className={`message__json-button ${!hasJsonData ? 'message__json-button--hidden' : ''}`}
                onClick={handleJsonClick}
                aria-label="View JSON"
                title="View response JSON"
                disabled={!hasJsonData}
              >
                {'{ }'}
              </button>
              <button
                className={`message__copy-button ${!message.content || message.isStreaming ? 'message__copy-button--hidden' : ''}`}
                onClick={handleCopyContent}
                aria-label="Copy message"
                title="Copy to clipboard"
                disabled={!message.content || message.isStreaming}
              >
                📋
              </button>
            </>
          )}
          {/* JSON button for user messages */}
          {isUser && hasJsonData && (
            <button
              className="message__json-button"
              onClick={handleJsonClick}
              aria-label="View JSON"
              title="View request JSON"
            >
              {'{ }'}
            </button>
          )}
        </div>
      </div>
      <div className="message__content-wrapper">
        {/* Attachments (for user messages) */}
        {hasAttachments && <MessageAttachments attachments={message.attachments!} />}

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
            {isUser || message.isError ? (
              // User messages and errors always render as plaintext
              message.content
            ) : (
              // Assistant messages use render mode
              <MessageContent content={message.content} renderMode={effectiveRenderMode} />
            )}
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
              {message.citations!.map((citation) => {
                const isSafeUrl = /^https?:\/\//i.test(citation.url);
                return (
                  <li key={citation.url} className="message__citation">
                    {isSafeUrl ? (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="message__citation-link"
                        title={citation.url}
                      >
                        {citation.title || citation.url}
                      </a>
                    ) : (
                      <span className="message__citation-link" title={citation.url}>
                        {citation.title || citation.url}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
