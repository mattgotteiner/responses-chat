/**
 * Button component for attaching files to messages
 */

import { useRef, useCallback, type ChangeEvent } from 'react';
import type { Attachment } from '../../types';
import {
  getAcceptString,
  isSupportedMimeType,
  createAttachmentFromFile,
  formatFileSize,
} from '../../utils/attachment';
import './AttachmentButton.css';

/** Maximum file size in bytes (10 MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Information about a rejected file */
export interface RejectedFile {
  /** Original filename */
  name: string;
  /** Reason for rejection */
  reason: 'unsupported-type' | 'file-too-large';
  /** Human-readable message */
  message: string;
}

/** Result of file selection */
export interface AttachmentResult {
  /** Successfully processed attachments */
  attachments: Attachment[];
  /** Files that were rejected */
  rejectedFiles: RejectedFile[];
}

interface AttachmentButtonProps {
  /** Handler called when files are selected */
  onAttach: (attachments: Attachment[]) => void;
  /** Optional handler called with full result including rejected files */
  onAttachResult?: (result: AttachmentResult) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Maximum file size in bytes (default: 10 MB) */
  maxFileSize?: number;
}

/**
 * Button that opens a file picker for attaching images or PDFs
 */
export function AttachmentButton({
  onAttach,
  onAttachResult,
  disabled = false,
  maxFileSize = MAX_FILE_SIZE_BYTES,
}: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const rejectedFiles: RejectedFile[] = [];
      const validFiles: File[] = [];

      // Validate each file for type and size
      Array.from(files).forEach((file) => {
        if (!isSupportedMimeType(file.type)) {
          rejectedFiles.push({
            name: file.name,
            reason: 'unsupported-type',
            message: `"${file.name}" has an unsupported file type (${file.type || 'unknown'}). Supported types: PNG, JPEG, WebP, and PDF.`,
          });
        } else if (file.size > maxFileSize) {
          rejectedFiles.push({
            name: file.name,
            reason: 'file-too-large',
            message: `"${file.name}" is too large (${formatFileSize(file.size)}). Maximum file size is ${formatFileSize(maxFileSize)}.`,
          });
        } else {
          validFiles.push(file);
        }
      });

      let attachments: Attachment[] = [];
      if (validFiles.length > 0) {
        try {
          attachments = await Promise.all(
            validFiles.map((file) => createAttachmentFromFile(file))
          );
          onAttach(attachments);
        } catch (error) {
          console.error('Failed to process attachments:', error);
        }
      }

      // Notify about complete result including rejections
      if (onAttachResult) {
        onAttachResult({ attachments, rejectedFiles });
      }

      // Reset input to allow selecting the same file again
      e.target.value = '';
    },
    [onAttach, onAttachResult, maxFileSize]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={getAcceptString()}
        multiple
        onChange={handleChange}
        className="attachment-button__input"
        aria-hidden="true"
        tabIndex={-1}
      />
      <button
        type="button"
        className="attachment-button"
        onClick={handleClick}
        disabled={disabled}
        aria-label="Attach file"
        title="Attach image or PDF"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </>
  );
}
