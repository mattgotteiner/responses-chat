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
 * Box that displays a tool call with name and arguments
 */
export function ToolCallBox({ toolCall }: ToolCallBoxProps) {
  // Try to format JSON arguments
  let formattedArgs = toolCall.arguments;
  try {
    const parsed = JSON.parse(toolCall.arguments);
    formattedArgs = JSON.stringify(parsed, null, 2);
  } catch {
    // Keep original if not valid JSON
  }

  return (
    <div className="tool-call-box">
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
    </div>
  );
}
