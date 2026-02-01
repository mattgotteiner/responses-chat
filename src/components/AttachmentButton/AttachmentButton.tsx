/**
 * Button component for attaching files to messages
 */

import { useRef, useCallback, type ChangeEvent } from 'react';
import type { Attachment } from '../../types';
import {
  getAcceptString,
  isSupportedMimeType,
  createAttachmentFromFile,
} from '../../utils/attachment';
import './AttachmentButton.css';

interface AttachmentButtonProps {
  /** Handler called when files are selected */
  onAttach: (attachments: Attachment[]) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Button that opens a file picker for attaching images or PDFs
 */
export function AttachmentButton({ onAttach, disabled = false }: AttachmentButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const validFiles = Array.from(files).filter((file) =>
        isSupportedMimeType(file.type)
      );

      if (validFiles.length === 0) {
        // Reset input so user can try again
        e.target.value = '';
        return;
      }

      try {
        const attachments = await Promise.all(
          validFiles.map((file) => createAttachmentFromFile(file))
        );
        onAttach(attachments);
      } catch (error) {
        console.error('Failed to process attachments:', error);
      }

      // Reset input to allow selecting the same file again
      e.target.value = '';
    },
    [onAttach]
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
