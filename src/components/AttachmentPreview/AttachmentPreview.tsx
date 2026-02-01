/**
 * Preview component for pending attachments
 */

import { useCallback } from 'react';
import type { Attachment } from '../../types';
import { isImageAttachment } from '../../utils/attachment';
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
 * Single attachment item with preview and remove button
 */
function AttachmentItem({ attachment, onRemove, disabled }: AttachmentItemProps) {
  const handleRemove = useCallback(() => {
    onRemove(attachment.id);
  }, [attachment.id, onRemove]);

  const isImage = isImageAttachment(attachment);

  return (
    <div className="attachment-preview__item">
      {isImage && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="attachment-preview__image"
        />
      ) : (
        <div className="attachment-preview__file">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="attachment-preview__file-icon"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span className="attachment-preview__filename" title={attachment.name}>
            {attachment.name}
          </span>
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
