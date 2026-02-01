/**
 * Content renderer with multiple render modes
 */

import ReactMarkdown from 'react-markdown';
import type { MessageRenderMode } from '../../types';
import './MessageContent.css';

interface MessageContentProps {
  /** The text content to render */
  content: string;
  /** Render mode: markdown, plaintext, or code */
  renderMode: MessageRenderMode;
}

/**
 * Renders message content based on the selected render mode
 */
export function MessageContent({ content, renderMode }: MessageContentProps) {
  switch (renderMode) {
    case 'markdown':
      return (
        <div className="message-content message-content--markdown">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      );
    case 'code':
      return (
        <div className="message-content message-content--code">
          <pre><code>{content}</code></pre>
        </div>
      );
    case 'plaintext':
    default:
      return (
        <div className="message-content message-content--plaintext">
          {content}
        </div>
      );
  }
}
