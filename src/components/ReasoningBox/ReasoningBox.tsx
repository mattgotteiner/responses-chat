/**
 * Collapsible box for displaying reasoning steps
 */

import { useState } from 'react';
import type { ReasoningStep } from '../../types';
import './ReasoningBox.css';

interface ReasoningBoxProps {
  /** Reasoning steps to display */
  reasoning: ReasoningStep[];
  /** Whether reasoning is still streaming */
  isStreaming?: boolean;
}

/**
 * Collapsible box that displays model reasoning steps
 */
export function ReasoningBox({
  reasoning,
  isStreaming = false,
}: ReasoningBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (reasoning.length === 0 && !isStreaming) {
    return null;
  }

  return (
    <div className="reasoning-box">
      <button
        className="reasoning-box__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="reasoning-box__title">
          Reasoning
          {isStreaming && <span className="reasoning-box__streaming">...</span>}
        </span>
        <span className={`reasoning-box__chevron ${isExpanded ? 'expanded' : ''}`}>
          ▶
        </span>
      </button>
      {isExpanded && (
        <div className="reasoning-box__content">
          {reasoning.map((step) => (
            <div key={step.id} className="reasoning-box__step">
              {step.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
