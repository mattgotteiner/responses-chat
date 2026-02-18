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
    
    // Create a mock file with unsupported type (video files are not supported)
    const unsupportedFile = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    
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
              name: 'test.mp4',
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
    
    // Use an audio file which is not supported
    const unsupportedFile = new File(['content'], 'audio.mp3', { 
      type: 'audio/mpeg',
    });
    
    Object.defineProperty(input, 'files', {
      value: [unsupportedFile],
      writable: false,
    });
    
    fireEvent.change(input);
    
    await waitFor(() => {
      const result = onAttachResult.mock.calls[0][0];
      expect(result.rejectedFiles[0].message).toContain('audio.mp3');
      expect(result.rejectedFiles[0].message).toContain('unsupported file type');
      // Without code interpreter, message should mention images and PDF only
      expect(result.rejectedFiles[0].message).toContain('images and PDF only');
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

describe('AttachmentButton codeInterpreterEnabled behavior', () => {
  describe('without code interpreter (default)', () => {
    it('only accepts images and PDFs in file input', () => {
      const onAttach = vi.fn();
      render(<AttachmentButton onAttach={onAttach} />);
      
      const input = document.querySelector('input[type="file"]');
      const accept = input?.getAttribute('accept') ?? '';
      
      // Should include images and PDF
      expect(accept).toContain('image/png');
      expect(accept).toContain('image/jpeg');
      expect(accept).toContain('application/pdf');
      
      // Should NOT include CSV, Excel, etc.
      expect(accept).not.toContain('text/csv');
      expect(accept).not.toContain('.xlsx');
    });

    it('rejects CSV files when code interpreter is disabled', async () => {
      const onAttach = vi.fn();
      const onAttachResult = vi.fn();
      render(
        <AttachmentButton
          onAttach={onAttach}
          onAttachResult={onAttachResult}
          codeInterpreterEnabled={false}
        />
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const csvFile = new File(['a,b,c'], 'data.csv', { type: 'text/csv' });
      
      Object.defineProperty(input, 'files', {
        value: [csvFile],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        expect(onAttachResult).toHaveBeenCalledWith(
          expect.objectContaining({
            attachments: [],
            rejectedFiles: [
              expect.objectContaining({
                name: 'data.csv',
                reason: 'unsupported-type',
              }),
            ],
          })
        );
      });
      
      expect(onAttach).not.toHaveBeenCalled();
    });

    it('shows appropriate tooltip without code interpreter', () => {
      const onAttach = vi.fn();
      render(<AttachmentButton onAttach={onAttach} codeInterpreterEnabled={false} />);
      
      const button = screen.getByRole('button', { name: /attach file/i });
      expect(button).toHaveAttribute('title', 'Attach files (images, PDF)');
    });
  });

  describe('with code interpreter enabled', () => {
    it('accepts all supported file types in file input', () => {
      const onAttach = vi.fn();
      render(<AttachmentButton onAttach={onAttach} codeInterpreterEnabled={true} />);
      
      const input = document.querySelector('input[type="file"]');
      const accept = input?.getAttribute('accept') ?? '';
      
      // Should include images
      expect(accept).toContain('image/png');
      expect(accept).toContain('image/jpeg');
      
      // Should include PDF
      expect(accept).toContain('application/pdf');
      
      // Should include CSV, Excel, etc.
      expect(accept).toContain('text/csv');
      expect(accept).toContain('.xlsx');
      expect(accept).toContain('.json');
    });

    it('shows appropriate tooltip with code interpreter', () => {
      const onAttach = vi.fn();
      render(<AttachmentButton onAttach={onAttach} codeInterpreterEnabled={true} />);
      
      const button = screen.getByRole('button', { name: /attach file/i });
      expect(button).toHaveAttribute('title', 'Attach files (images, PDF, CSV, JSON, Excel, Word, code)');
    });

    it('provides appropriate rejection message when code interpreter is enabled', async () => {
      const onAttach = vi.fn();
      const onAttachResult = vi.fn();
      
      render(
        <AttachmentButton
          onAttach={onAttach}
          onAttachResult={onAttachResult}
          codeInterpreterEnabled={true}
        />
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Use a video file which is never supported
      const unsupportedFile = new File(['content'], 'video.mp4', { 
        type: 'video/mp4',
      });
      
      Object.defineProperty(input, 'files', {
        value: [unsupportedFile],
        writable: false,
      });
      
      fireEvent.change(input);
      
      await waitFor(() => {
        const result = onAttachResult.mock.calls[0][0];
        // With code interpreter, message should mention all supported types
        expect(result.rejectedFiles[0].message).toContain('images, PDF, CSV, JSON, Excel, Word, and text files');
      });
    });
  });
});
