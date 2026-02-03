/**
 * Box for displaying tool call information
 */

import { useState } from 'react';
import type { ToolCall } from '../../types';
import './ToolCallBox.css';

interface ToolCallBoxProps {
  /** Tool call to display */
  toolCall: ToolCall;
  /** Handler when user approves an MCP tool call */
  onApprove?: (approvalRequestId: string) => void;
  /** Handler when user denies an MCP tool call */
  onDeny?: (approvalRequestId: string) => void;
}

/**
 * Renders a web search call with query and status
 */
function WebSearchCallContent({ toolCall }: { toolCall: ToolCall }) {
  const isOpenPage = toolCall.webSearchActionType === 'open_page';
  
  const statusLabels: Record<string, string> = isOpenPage
    ? {
        in_progress: 'Opening page...',
        searching: 'Opening page...',
        completed: 'Page opened',
        aborted: 'Aborted',
      }
    : {
        in_progress: 'Searching...',
        searching: 'Searching...',
        completed: 'Search complete',
        aborted: 'Aborted',
      };
  const statusLabel = statusLabels[toolCall.status || 'in_progress'] || (isOpenPage ? 'Opening page...' : 'Searching...');

  return (
    <>
      <div className="tool-call-box__header">
        <span className="tool-call-box__icon">{isOpenPage ? '📄' : '🔍'}</span>
        <span className="tool-call-box__name">{isOpenPage ? 'Open Page' : 'Web Search'}</span>
        <span className={`tool-call-box__status tool-call-box__status--${toolCall.status || 'in_progress'}`}>
          {statusLabel}
        </span>
      </div>
      {toolCall.query ? (
        <div className="tool-call-box__query">
          <span className="tool-call-box__query-label">Query:</span>
          <span className="tool-call-box__query-text">{toolCall.query}</span>
        </div>
      ) : null}
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
    aborted: 'Aborted',
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
 * Renders an MCP (Model Context Protocol) server call
 */
function McpCallContent({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusLabels: Record<string, string> = {
    in_progress: 'Calling...',
    completed: 'Complete',
    aborted: 'Aborted',
  };
  const statusLabel = statusLabels[toolCall.status || 'in_progress'] || 'Calling...';

  // Try to format JSON arguments
  let formattedArgs = toolCall.arguments;
  try {
    const parsed = JSON.parse(toolCall.arguments);
    formattedArgs = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  const hasContent = toolCall.arguments || toolCall.result;

  return (
    <>
      <button
        className="tool-call-box__header tool-call-box__header--clickable"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        disabled={!hasContent}
      >
        <span className="tool-call-box__icon">🔌</span>
        <span className="tool-call-box__name">{toolCall.name}</span>
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
          {toolCall.arguments && (
            <div className="tool-call-box__arguments">
              <div className="tool-call-box__arguments-label">Arguments</div>
              <pre>{formattedArgs}</pre>
            </div>
          )}
          {toolCall.result && (
            <div className="tool-call-box__result">
              <div className="tool-call-box__result-label">Result:</div>
              <pre>{toolCall.result}</pre>
            </div>
          )}
        </>
      )}
    </>
  );
}

/**
 * Renders an MCP approval request with approve/deny buttons
 */
function McpApprovalContent({
  toolCall,
  onApprove,
  onDeny,
}: {
  toolCall: ToolCall;
  onApprove?: (approvalRequestId: string) => void;
  onDeny?: (approvalRequestId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isPending = toolCall.status === 'pending_approval';
  const isApproved = toolCall.status === 'approved';
  const isDenied = toolCall.status === 'denied';

  const statusLabels: Record<string, string> = {
    pending_approval: 'Approval Required',
    approved: 'Approved',
    denied: 'Denied',
  };
  const statusLabel = statusLabels[toolCall.status || 'pending_approval'] || 'Approval Required';

  // Try to format JSON arguments
  let formattedArgs = toolCall.arguments;
  try {
    const parsed = JSON.parse(toolCall.arguments);
    formattedArgs = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  const handleApprove = () => {
    if (onApprove && toolCall.approvalRequestId) {
      onApprove(toolCall.approvalRequestId);
    }
  };

  const handleDeny = () => {
    if (onDeny && toolCall.approvalRequestId) {
      onDeny(toolCall.approvalRequestId);
    }
  };

  return (
    <>
      <button
        className="tool-call-box__header tool-call-box__header--clickable"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
      >
        <span className="tool-call-box__icon">⚠️</span>
        <span className="tool-call-box__name">{toolCall.name}</span>
        <span className={`tool-call-box__status tool-call-box__status--${toolCall.status || 'pending_approval'}`}>
          {statusLabel}
        </span>
        <span className={`tool-call-box__chevron ${isExpanded ? 'expanded' : ''}`}>
          ▶
        </span>
      </button>
      {isExpanded && (
        <>
          {toolCall.arguments && (
            <div className="tool-call-box__arguments">
              <div className="tool-call-box__arguments-label">Arguments</div>
              <pre>{formattedArgs}</pre>
            </div>
          )}
          {isPending && (
            <div className="tool-call-box__approval-actions">
              <button
                type="button"
                className="tool-call-box__approve-btn"
                onClick={handleApprove}
              >
                ✓ Approve
              </button>
              <button
                type="button"
                className="tool-call-box__deny-btn"
                onClick={handleDeny}
              >
                ✕ Deny
              </button>
            </div>
          )}
          {isApproved && (
            <div className="tool-call-box__approval-result tool-call-box__approval-result--approved">
              ✓ Tool call approved
            </div>
          )}
          {isDenied && (
            <div className="tool-call-box__approval-result tool-call-box__approval-result--denied">
              ✕ Tool call denied by user
            </div>
          )}
        </>
      )}
    </>
  );
}

/**
 * Box that displays a tool call with name and arguments
 */
export function ToolCallBox({ toolCall, onApprove, onDeny }: ToolCallBoxProps) {
  const isWebSearch = toolCall.type === 'web_search';
  const isCodeInterpreter = toolCall.type === 'code_interpreter';
  const isMcp = toolCall.type === 'mcp';
  const isMcpApproval = toolCall.type === 'mcp_approval';

  const isAborted = toolCall.status === 'aborted';
  const isPendingApproval = toolCall.status === 'pending_approval';
  const variantClass = isAborted
    ? 'tool-call-box--aborted'
    : isPendingApproval
      ? 'tool-call-box--pending-approval'
      : isWebSearch
        ? 'tool-call-box--web-search'
        : isCodeInterpreter
          ? 'tool-call-box--code-interpreter'
          : isMcp || isMcpApproval
            ? 'tool-call-box--mcp'
            : '';

  return (
    <div className={`tool-call-box ${variantClass}`}>
      {isWebSearch ? (
        <WebSearchCallContent toolCall={toolCall} />
      ) : isCodeInterpreter ? (
        <CodeInterpreterCallContent toolCall={toolCall} />
      ) : isMcpApproval ? (
        <McpApprovalContent toolCall={toolCall} onApprove={onApprove} onDeny={onDeny} />
      ) : isMcp ? (
        <McpCallContent toolCall={toolCall} />
      ) : (
        <FunctionCallContent toolCall={toolCall} />
      )}
    </div>
  );
}
