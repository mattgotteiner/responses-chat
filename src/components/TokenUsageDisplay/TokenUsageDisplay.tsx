/**
 * Component to display token usage statistics
 */

import type { TokenUsage } from '../../types';
import './TokenUsageDisplay.css';

/** Display mode for the token usage component */
export type TokenUsageDisplayMode = 'compact' | 'detailed';

interface TokenUsageDisplayProps {
  /** Token usage data to display (undefined shows empty state) */
  usage: TokenUsage | undefined;
  /** Display mode - compact for header, detailed for sidebar */
  mode?: TokenUsageDisplayMode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Formats a number with comma separators for readability
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Displays token usage statistics in compact or detailed format
 */
export function TokenUsageDisplay({
  usage,
  mode = 'compact',
  className = '',
}: TokenUsageDisplayProps) {
  // Show empty state when no usage data
  if (!usage) {
    if (mode === 'compact') {
      return (
        <div className={`token-usage token-usage--compact token-usage--empty ${className}`.trim()}>
          <span className="token-usage__label">Tokens:</span>
          <span className="token-usage__value token-usage__value--empty">—</span>
        </div>
      );
    }
    return null; // Don't show detailed empty state in sidebar
  }

  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0;

  if (mode === 'compact') {
    return (
      <div className={`token-usage token-usage--compact ${className}`.trim()}>
        <span className="token-usage__label">Tokens:</span>
        <span className="token-usage__value">{formatNumber(usage.total_tokens)}</span>
        <span className="token-usage__breakdown">
          ({formatNumber(usage.input_tokens)} in / {formatNumber(usage.output_tokens)} out)
        </span>
      </div>
    );
  }

  return (
    <div className={`token-usage token-usage--detailed ${className}`.trim()}>
      <div className="token-usage__header">
        <span className="token-usage__icon">📊</span>
        <span className="token-usage__title">Token Usage</span>
      </div>
      <div className="token-usage__grid">
        <div className="token-usage__row">
          <span className="token-usage__row-label">Input tokens</span>
          <span className="token-usage__row-value">{formatNumber(usage.input_tokens)}</span>
        </div>
        {cachedTokens > 0 && (
          <div className="token-usage__row token-usage__row--sub">
            <span className="token-usage__row-label">↳ Cached</span>
            <span className="token-usage__row-value">{formatNumber(cachedTokens)}</span>
          </div>
        )}
        <div className="token-usage__row">
          <span className="token-usage__row-label">Output tokens</span>
          <span className="token-usage__row-value">{formatNumber(usage.output_tokens)}</span>
        </div>
        {reasoningTokens > 0 && (
          <div className="token-usage__row token-usage__row--sub">
            <span className="token-usage__row-label">↳ Reasoning</span>
            <span className="token-usage__row-value">{formatNumber(reasoningTokens)}</span>
          </div>
        )}
        <div className="token-usage__row token-usage__row--total">
          <span className="token-usage__row-label">Total</span>
          <span className="token-usage__row-value">{formatNumber(usage.total_tokens)}</span>
        </div>
      </div>
    </div>
  );
}
