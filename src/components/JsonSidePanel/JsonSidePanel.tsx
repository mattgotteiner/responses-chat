/**
 * Side panel for displaying raw JSON data
 */

import { useCallback, useMemo } from 'react';
import { extractTokenUsage } from '../../types';
import { TokenUsageDisplay } from '../TokenUsageDisplay';
import './JsonSidePanel.css';

/** Data to display in the JSON side panel */
export interface JsonPanelData {
  /** Title for the panel header */
  title: string;
  /** JSON data to display */
  data: Record<string, unknown>;
}

interface JsonSidePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Handler to close the panel */
  onClose: () => void;
  /** Panel data to display */
  panelData: JsonPanelData | null;
}

/**
 * Slide-in panel from the right side showing formatted JSON
 */
export function JsonSidePanel({
  isOpen,
  onClose,
  panelData,
}: JsonSidePanelProps) {
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleCopy = useCallback(async () => {
    if (panelData) {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(panelData.data, null, 2)
        );
      } catch {
        // Clipboard write failed silently
      }
    }
  }, [panelData]);

  // Extract token usage from response JSON if present
  const tokenUsage = useMemo(() => {
    if (!panelData) return undefined;
    return extractTokenUsage(panelData.data);
  }, [panelData]);

  if (!isOpen || !panelData) {
    return null;
  }

  return (
    <div className="json-panel-overlay" onClick={handleOverlayClick}>
      <div className="json-side-panel">
        <div className="json-side-panel__header">
          <h2 className="json-side-panel__title">{panelData.title}</h2>
          <div className="json-side-panel__actions">
            <button
              className="json-side-panel__copy"
              onClick={handleCopy}
              aria-label="Copy JSON"
              title="Copy to clipboard"
            >
              📋
            </button>
            <button
              className="json-side-panel__close"
              onClick={onClose}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="json-side-panel__content">
          {tokenUsage && (
            <TokenUsageDisplay usage={tokenUsage} mode="detailed" />
          )}
          <pre className="json-side-panel__json">
            {JSON.stringify(panelData.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
