/**
 * Box for displaying tool call information
 */

import { useState } from 'react';
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
  const statusLabels: Record<string, string> = {
    in_progress: 'Searching...',
    searching: 'Searching...',
    completed: 'Search complete',
  };
  const statusLabel = statusLabels[toolCall.status || 'in_progress'] || 'Searching...';

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
 * Renders a collapsible code interpreter call with code and output
 */
function CodeInterpreterCallContent({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusLabels: Record<string, string> = {
    in_progress: 'Running...',
    interpreting: 'Executing...',
    completed: 'Complete',
  };
  const statusLabel = statusLabels[toolCall.status || 'in_progress'] || 'Running...';
  const hasContent = toolCall.code || toolCall.output;

  return (
    <>
      <button
        className="tool-call-box__header tool-call-box__header--clickable"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        disabled={!hasContent}
      >
        <span className="tool-call-box__icon">🐍</span>
        <span className="tool-call-box__name">Code Interpreter</span>
        <span className={`tool-call-box__status tool-call-box__status--${toolCall.status || 'in_progress'}`}>
          {statusLabel}
        </span>
        {hasContent && (
          <span className={`tool-call-box__chevron ${isExpanded ? 'expanded' : ''}`}>
            ▶
          </span>
        )}
      </button>
      {isExpanded && (
        <>
          {toolCall.code && (
            <div className="tool-call-box__code">
              <div className="tool-call-box__code-label">Python</div>
              <pre className="tool-call-box__code-block"><code>{toolCall.code}</code></pre>
            </div>
          )}
          {toolCall.output && (
            <div className="tool-call-box__output">
              <div className="tool-call-box__output-label">Output</div>
              <pre className="tool-call-box__output-block">{toolCall.output}</pre>
            </div>
          )}
        </>
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
  const isCodeInterpreter = toolCall.type === 'code_interpreter';

  const variantClass = isWebSearch
    ? 'tool-call-box--web-search'
    : isCodeInterpreter
      ? 'tool-call-box--code-interpreter'
      : '';

  return (
    <div className={`tool-call-box ${variantClass}`}>
      {isWebSearch ? (
        <WebSearchCallContent toolCall={toolCall} />
      ) : isCodeInterpreter ? (
        <CodeInterpreterCallContent toolCall={toolCall} />
      ) : (
        <FunctionCallContent toolCall={toolCall} />
      )}
    </div>
  );
}
