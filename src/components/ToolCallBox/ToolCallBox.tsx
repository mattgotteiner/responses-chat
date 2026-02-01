/**
 * Box for displaying tool call information
 */

import type { ToolCall } from '../../types';
import './ToolCallBox.css';

interface ToolCallBoxProps {
  /** Tool call to display */
  toolCall: ToolCall;
}

/**
 * Renders a web search call with query and status
 */
function WebSearchCallContent({ toolCall }: { toolCall: ToolCall }) {
  const statusLabel = {
    in_progress: 'Searching...',
    searching: 'Searching...',
    completed: 'Search complete',
  }[toolCall.status || 'in_progress'];

  return (
    <>
      <div className="tool-call-box__header">
        <span className="tool-call-box__icon">🔍</span>
        <span className="tool-call-box__name">Web Search</span>
        <span className={`tool-call-box__status tool-call-box__status--${toolCall.status || 'in_progress'}`}>
          {statusLabel}
        </span>
      </div>
      {toolCall.query && (
        <div className="tool-call-box__query">
          <span className="tool-call-box__query-label">Query:</span>
          <span className="tool-call-box__query-text">{toolCall.query}</span>
        </div>
      )}
    </>
  );
}

/**
 * Renders a function call with name and arguments
 */
function FunctionCallContent({ toolCall }: { toolCall: ToolCall }) {
  // Try to format JSON arguments
  let formattedArgs = toolCall.arguments;
  try {
    const parsed = JSON.parse(toolCall.arguments);
    formattedArgs = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  return (
    <>
      <div className="tool-call-box__header">
        <span className="tool-call-box__icon">🔧</span>
        <span className="tool-call-box__name">{toolCall.name}</span>
      </div>
      <div className="tool-call-box__arguments">
        <pre>{formattedArgs}</pre>
      </div>
      {toolCall.result && (
        <div className="tool-call-box__result">
          <div className="tool-call-box__result-label">Result:</div>
          <pre>{toolCall.result}</pre>
        </div>
      )}
    </>
  );
}

/**
 * Box that displays a tool call with name and arguments
 */
export function ToolCallBox({ toolCall }: ToolCallBoxProps) {
  const isWebSearch = toolCall.type === 'web_search';

  return (
    <div className={`tool-call-box ${isWebSearch ? 'tool-call-box--web-search' : ''}`}>
      {isWebSearch ? (
        <WebSearchCallContent toolCall={toolCall} />
      ) : (
        <FunctionCallContent toolCall={toolCall} />
      )}
    </div>
  );
}
