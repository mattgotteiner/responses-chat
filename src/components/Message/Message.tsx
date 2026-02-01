/**
 * Single message component
 */

import { useCallback, useState } from 'react';
import type { Message as MessageType, MessageRenderMode } from '../../types';
import type { JsonPanelData } from '../JsonSidePanel';
import { ReasoningBox } from '../ReasoningBox';
import { ToolCallBox } from '../ToolCallBox';
import { MessageContent } from './MessageContent';
import { useSettingsContext } from '../../context/SettingsContext';
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
      </div>
    </div>
  );
}
