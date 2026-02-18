/**
 * Preview component for pending attachments
 */

import { useCallback } from 'react';
import type { Attachment } from '../../types';
import { isImageAttachment, formatFileSize, getFileCategory, type FileCategory } from '../../utils/attachment';
import './AttachmentPreview.css';

interface AttachmentPreviewProps {
  /** Attachments to display */
  attachments: Attachment[];
  /** Handler called when an attachment is removed */
  onRemove: (id: string) => void;
  /** Whether removal is disabled */
  disabled?: boolean;
}

interface AttachmentItemProps {
  /** The attachment to display */
  attachment: Attachment;
  /** Handler called when remove is clicked */
  onRemove: (id: string) => void;
  /** Whether removal is disabled */
  disabled: boolean;
}

/**
 * SVG icon for PDF files
 */
function PdfIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon attachment-preview__file-icon--pdf">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15h.01M12 15h.01M15 15h.01" />
    </svg>
  );
}

/**
 * SVG icon for spreadsheet files (CSV, Excel)
 */
function SpreadsheetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon attachment-preview__file-icon--spreadsheet">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="10" y1="9" x2="10" y2="21" />
    </svg>
  );
}

/**
 * SVG icon for document files (Word)
 */
function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon attachment-preview__file-icon--document">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

/**
 * SVG icon for code files (JS, TS, Python)
 */
function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon attachment-preview__file-icon--code">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

/**
 * SVG icon for data files (JSON, XML)
 */
function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon attachment-preview__file-icon--data">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h2l1 2 2-4 1 2h2" />
    </svg>
  );
}

/**
 * SVG icon for text/markdown files
 */
function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon attachment-preview__file-icon--text">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

/**
 * SVG icon for generic files
 */
function GenericFileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="attachment-preview__file-icon">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

/**
 * Get the appropriate icon component for a file category
 */
function FileIcon({ category }: { category: FileCategory }) {
  switch (category) {
    case 'pdf':
      return <PdfIcon />;
    case 'spreadsheet':
      return <SpreadsheetIcon />;
    case 'document':
      return <DocumentIcon />;
    case 'code':
      return <CodeIcon />;
    case 'data':
      return <DataIcon />;
    case 'text':
      return <TextIcon />;
    default:
      return <GenericFileIcon />;
  }
}

/**
 * Single attachment item with preview and remove button
 */
function AttachmentItem({ attachment, onRemove, disabled }: AttachmentItemProps) {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [attachment.id, onRemove]);

  const isImage = isImageAttachment(attachment);
  const fileCategory = getFileCategory(attachment.mimeType);

  return (
    <div className="attachment-preview__item">
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="attachment-preview__image"
        />
      ) : (
        <div className={`attachment-preview__file attachment-preview__file--${fileCategory}`}>
          <FileIcon category={fileCategory} />
          <div className="attachment-preview__file-info">
            <span className="attachment-preview__filename" title={attachment.name}>
              {attachment.name}
            </span>
            <span className="attachment-preview__filesize">
              {formatFileSize(attachment.size)}
            </span>
          </div>
        </div>
      )}
      <button
        type="button"
        className="attachment-preview__remove"
        onClick={handleRemove}
        disabled={disabled}
        aria-label={`Remove ${attachment.name}`}
        title="Remove attachment"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Displays a row of pending attachments with remove buttons
 */
export function AttachmentPreview({
  attachments,
  onRemove,
  disabled = false,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="attachment-preview">
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
