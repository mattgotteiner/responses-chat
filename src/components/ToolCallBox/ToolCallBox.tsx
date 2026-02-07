/**
 * Box for displaying tool call information
 */

import { useState } from 'react';
import type { ToolCall, FileCitation } from '../../types';
import './ToolCallBox.css';

interface ToolCallBoxProps {
  /** Tool call to display */
  toolCall: ToolCall;
  /** Handler when user approves an MCP tool call */
  onApprove?: (approvalRequestId: string) => void;
  /** Handler when user denies an MCP tool call */
  onDeny?: (approvalRequestId: string) => void;
  /** File citations from file search (for result count display) */
  fileCitations?: FileCitation[];
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
  const [expandedImageIndex, setExpandedImageIndex] = useState<number | null>(null);
  const statusLabels: Record<string, string> = {
    in_progress: 'Running...',
    interpreting: 'Executing...',
    completed: 'Complete',
    aborted: 'Aborted',
  };
  const statusLabel = statusLabels[toolCall.status || 'in_progress'] || 'Running...';
  const hasContent = toolCall.code || toolCall.output || (toolCall.codeInterpreterImages && toolCall.codeInterpreterImages.length > 0);

  const handleImageClick = (index: number) => {
    setExpandedImageIndex(expandedImageIndex === index ? null : index);
  };

  const handleImageKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleImageClick(index);
    } else if (e.key === 'Escape' && expandedImageIndex !== null) {
      setExpandedImageIndex(null);
    }
  };

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
          {toolCall.codeInterpreterImages && toolCall.codeInterpreterImages.length > 0 && (
            <div className="tool-call-box__images">
              <div className="tool-call-box__images-label">Generated Images</div>
              <div className="tool-call-box__images-grid">
                {toolCall.codeInterpreterImages.map((image, idx) => (
                  <div
                    key={idx}
                    className={`tool-call-box__image-container ${expandedImageIndex === idx ? 'expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleImageClick(idx)}
                    onKeyDown={(e) => handleImageKeyDown(e, idx)}
                    aria-label={`Generated image ${idx + 1}${expandedImageIndex === idx ? ' (expanded, press Escape to collapse)' : ' (click to expand)'}`}
                  >
                    <img
                      src={image.url}
                      alt={`Generated output ${idx + 1}`}
                      className="tool-call-box__image"
                    />
                  </div>
                ))}
              </div>
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
 * Truncates text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Formats a relevance score as a percentage
 */
function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/**
 * Renders a file search call with query and results
 */
function FileSearchCallContent({ toolCall, fileCitations }: { toolCall: ToolCall; fileCitations?: FileCitation[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // File search results come from file_citation annotations, not from the tool call itself
  // (the API always returns results: null in the streamed data)
  const hasCitations = fileCitations !== undefined && fileCitations.length > 0;
  const resultCount = fileCitations?.length ?? 0;
  
  const getCompletedLabel = (): string => {
    if (!hasCitations) return 'Completed'; // No citations yet, just show completed
    return `${resultCount} result${resultCount !== 1 ? 's' : ''}`;
  };
  
  const statusLabels: Record<string, string> = {
    in_progress: 'Searching...',
    searching: 'Searching...',
    completed: getCompletedLabel(),
    aborted: 'Aborted',
  };
  const statusLabel = statusLabels[toolCall.status || 'in_progress'] || 'Searching...';
  // Show content if we have query, file search results, or file citations
  const hasContent = toolCall.query || toolCall.fileSearchResults?.length || (fileCitations && fileCitations.length > 0);

  return (
    <>
      <button
        className="tool-call-box__header tool-call-box__header--clickable"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        disabled={!hasContent}
      >
        <span className="tool-call-box__icon">📁</span>
        <span className="tool-call-box__name">File Search</span>
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
          {toolCall.query && (
            <div className="tool-call-box__query">
              <span className="tool-call-box__query-label">Query:</span>
              <span className="tool-call-box__query-text">{toolCall.query}</span>
            </div>
          )}
          {/* Show file search results if available (includes score and text) */}
          {toolCall.fileSearchResults && toolCall.fileSearchResults.length > 0 && (
            <div className="tool-call-box__file-results">
              <div className="tool-call-box__file-results-label">Results</div>
              <div className="tool-call-box__file-results-list">
                {toolCall.fileSearchResults.map((result, idx) => (
                  <div key={`${result.fileId}-${idx}`} className="tool-call-box__file-result">
                    <div className="tool-call-box__file-result-header">
                      <span className="tool-call-box__file-result-name" title={result.filename}>
                        {result.filename}
                      </span>
                      <span className="tool-call-box__file-result-score">
                        {formatScore(result.score)}
                      </span>
                    </div>
                    <div className="tool-call-box__file-result-text">
                      {truncateText(result.text, 200)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Fallback: show file citations if results are null (API returns citations separately) */}
          {(!toolCall.fileSearchResults || toolCall.fileSearchResults.length === 0) && 
           fileCitations && fileCitations.length > 0 && (
            <div className="tool-call-box__file-results">
              <div className="tool-call-box__file-results-label">Files Referenced</div>
              <div className="tool-call-box__file-results-list">
                {fileCitations.map((citation, idx) => (
                  <div key={`${citation.fileId}-${idx}`} className="tool-call-box__file-result tool-call-box__file-result--citation">
                    <div className="tool-call-box__file-result-header">
                      <span className="tool-call-box__file-result-icon">📄</span>
                      <span className="tool-call-box__file-result-name" title={citation.filename}>
                        {citation.filename}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
export function ToolCallBox({ toolCall, onApprove, onDeny, fileCitations }: ToolCallBoxProps) {
  const isWebSearch = toolCall.type === 'web_search';
  const isCodeInterpreter = toolCall.type === 'code_interpreter';
  const isFileSearch = toolCall.type === 'file_search';
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
          : isFileSearch
            ? 'tool-call-box--file-search'
            : isMcp || isMcpApproval
              ? 'tool-call-box--mcp'
              : '';

  return (
    <div className={`tool-call-box ${variantClass}`}>
      {isWebSearch ? (
        <WebSearchCallContent toolCall={toolCall} />
      ) : isCodeInterpreter ? (
        <CodeInterpreterCallContent toolCall={toolCall} />
      ) : isFileSearch ? (
        <FileSearchCallContent toolCall={toolCall} fileCitations={fileCitations} />
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
