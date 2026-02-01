/**
 * Tests for AttachmentButton component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttachmentButton, MAX_FILE_SIZE_BYTES } from './AttachmentButton';

describe('AttachmentButton', () => {
  it('renders attach button', () => {
    const onAttach = vi.fn();
    render(<AttachmentButton onAttach={onAttach} />);
    
    expect(screen.getByRole('button', { name: /attach file/i })).toBeInTheDocument();
  });

  it('opens file picker on click', () => {
    const onAttach = vi.fn();
    render(<AttachmentButton onAttach={onAttach} />);
    
    const button = screen.getByRole('button', { name: /attach file/i });
    
    // The input should exist but be hidden
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept');
    
    // Click should trigger input click (we can't fully test this without more mocking)
    fireEvent.click(button);
  });

  it('is disabled when disabled prop is true', () => {
    const onAttach = vi.fn();
    render(<AttachmentButton onAttach={onAttach} disabled />);
    
    expect(screen.getByRole('button', { name: /attach file/i })).toBeDisabled();
  });

  it('accepts multiple files', () => {
    const onAttach = vi.fn();
    render(<AttachmentButton onAttach={onAttach} />);
    
    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('multiple');
  });

  it('has correct accept types', () => {
    const onAttach = vi.fn();
    render(<AttachmentButton onAttach={onAttach} />);
    
    const input = document.querySelector('input[type="file"]');
    const accept = input?.getAttribute('accept') ?? '';
    expect(accept).toContain('image/png');
    expect(accept).toContain('image/jpeg');
    expect(accept).toContain('application/pdf');
  });

  it('exports MAX_FILE_SIZE_BYTES constant', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('AttachmentButton file validation', () => {
  it('rejects files with unsupported MIME types via onAttachResult', async () => {
    const onAttach = vi.fn();
    const onAttachResult = vi.fn();
    render(
      <AttachmentButton
        onAttach={onAttach}
        onAttachResult={onAttachResult}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create a mock file with unsupported type
    const unsupportedFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    // Simulate file selection
    Object.defineProperty(input, 'files', {
      value: [unsupportedFile],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      expect(onAttachResult).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [],
          rejectedFiles: [
            expect.objectContaining({
              name: 'test.txt',
              reason: 'unsupported-type',
            }),
          ],
        })
      );
    });
    
    // onAttach should not be called when no valid files
    expect(onAttach).not.toHaveBeenCalled();
  });

  it('rejects files that exceed max size via onAttachResult', async () => {
    const onAttach = vi.fn();
    const onAttachResult = vi.fn();
    const smallMaxSize = 100; // 100 bytes
    
    render(
      <AttachmentButton
        onAttach={onAttach}
        onAttachResult={onAttachResult}
        maxFileSize={smallMaxSize}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Create a file larger than the limit
    const largeContent = 'x'.repeat(200);
    const largeFile = new File([largeContent], 'large.png', { type: 'image/png' });
    
    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      expect(onAttachResult).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [],
          rejectedFiles: [
            expect.objectContaining({
              name: 'large.png',
              reason: 'file-too-large',
            }),
          ],
        })
      );
    });
  });

  it('provides human-readable rejection messages', async () => {
    const onAttach = vi.fn();
    const onAttachResult = vi.fn();
    
    render(
      <AttachmentButton
        onAttach={onAttach}
        onAttachResult={onAttachResult}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const unsupportedFile = new File(['content'], 'document.docx', { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    
    Object.defineProperty(input, 'files', {
      value: [unsupportedFile],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      const result = onAttachResult.mock.calls[0][0];
      expect(result.rejectedFiles[0].message).toContain('document.docx');
      expect(result.rejectedFiles[0].message).toContain('unsupported file type');
      expect(result.rejectedFiles[0].message).toContain('PNG, JPEG, WebP, and PDF');
    });
  });

  it('accepts custom maxFileSize prop', () => {
    const onAttach = vi.fn();
    const customMaxSize = 5 * 1024 * 1024; // 5 MB
    
    render(
      <AttachmentButton
        onAttach={onAttach}
        maxFileSize={customMaxSize}
      />
    );

    // Component renders without error with custom max size
    expect(screen.getByRole('button', { name: /attach file/i })).toBeInTheDocument();
  });
});
