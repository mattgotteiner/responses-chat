/**
 * Content renderer with multiple render modes
 */

import { useMemo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { MessageRenderMode, ContainerFileCitation } from '../../types';
import './MessageContent.css';

/**
 * Custom URL transform that allows sandbox: scheme for code interpreter files
 * while still sanitizing other URLs with the default transform
 */
function customUrlTransform(url: string): string {
  // Allow sandbox: URLs to pass through (used by code interpreter)
  if (url.startsWith('sandbox:')) {
    return url;
  }
  // Use default transform for all other URLs
  return defaultUrlTransform(url);
}

interface MessageContentProps {
  /** The text content to render */
  content: string;
  /** Render mode: markdown, plaintext, or code */
  renderMode: MessageRenderMode;
  /** Container file citations for downloadable files from code interpreter */
  containerFileCitations?: ContainerFileCitation[];
  /** Handler to download a container file */
  onDownloadFile?: (file: ContainerFileCitation) => void;
}

/**
 * Extracts the filename from a sandbox path
 * e.g., "sandbox:/mnt/data/widget_plot.png" -> "widget_plot.png"
 * e.g., "/mnt/data/file.csv" -> "file.csv"
 */
function extractFilenameFromPath(path: string): string | null {
  // Remove sandbox: prefix if present
  const cleanPath = path.replace(/^sandbox:/i, '');
  // Extract filename from path
  const parts = cleanPath.split('/');
  const filename = parts[parts.length - 1];
  return filename || null;
}

/**
 * Creates a custom link component that can handle sandbox paths
 * Only enables sandbox path handling when containerFileCitations is provided (code interpreter context)
 */
function createExternalLink(
  containerFileCitations?: ContainerFileCitation[],
  onDownloadFile?: (file: ContainerFileCitation) => void
) {
  // Only enable sandbox path handling if we're in a code interpreter context (have citations)
  const enableSandboxHandling = containerFileCitations && containerFileCitations.length > 0;
  
  return function ExternalLink({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
    // Only allow http/https links for security
    const isSafeUrl = href && /^https?:\/\//i.test(href);
    
    // Check if this is a sandbox /mnt/ path from code interpreter
    const isSandboxPath = href && (/^\/mnt\//i.test(href) || /^sandbox:/i.test(href));
    
    // Only handle sandbox paths specially when in code interpreter context
    if (isSandboxPath && enableSandboxHandling && onDownloadFile) {
      // Try to find matching file citation by filename
      const filename = extractFilenameFromPath(href);
      const matchingFile = filename
        ? containerFileCitations.find((f) => f.filename === filename)
        : null;
      
      if (matchingFile) {
        // Render as clickable download button
        return (
          <button
            type="button"
            className="message-content__download-link"
            onClick={() => onDownloadFile(matchingFile)}
            title={`Download ${matchingFile.filename}`}
          >
            <span className="message-content__download-icon">📥</span>
            {children}
          </button>
        );
      }
      
      // In code interpreter context but no matching citation found
      // These files may be available in the "Generated Files" section
      return (
        <span 
          className="message-content__sandbox-link" 
          title="This file is available in the Generated Files section below"
        >
          <span className="message-content__sandbox-icon">📄</span>
          {children}
        </span>
      );
    }
    
    if (!isSafeUrl) {
      // Render non-http links (including sandbox paths outside code interpreter) as plain text
      return <span className="message-content__unsafe-link">{children}</span>;
    }
    
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  };
}

/**
 * Renders message content based on the selected render mode
 */
export function MessageContent({ content, renderMode, containerFileCitations, onDownloadFile }: MessageContentProps) {
  // Memoize the ExternalLink component to avoid recreating on every render
  const ExternalLink = useMemo(
    () => createExternalLink(containerFileCitations, onDownloadFile),
    [containerFileCitations, onDownloadFile]
  );

  switch (renderMode) {
    case 'markdown':
      return (
        <div className="message-content message-content--markdown">
          <ReactMarkdown 
            urlTransform={customUrlTransform}
            components={{ a: ExternalLink }}
          >
            {content}
          </ReactMarkdown>
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
