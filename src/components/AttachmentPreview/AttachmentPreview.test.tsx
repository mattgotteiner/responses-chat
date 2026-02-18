/**
 * Tests for AttachmentPreview component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentPreview } from './AttachmentPreview';
import type { Attachment } from '../../types';

describe('AttachmentPreview', () => {
  const createImageAttachment = (id: string, name: string): Attachment => ({
    id,
    name,
    type: 'image',
    mimeType: 'image/png',
    base64: 'abc123',
    previewUrl: 'data:image/png;base64,abc123',
    size: 1024,
  });

  const createFileAttachment = (id: string, name: string, mimeType = 'application/pdf'): Attachment => ({
    id,
    name,
    type: 'file',
    mimeType,
    base64: 'abc123',
    size: 2048,
  });

  it('renders nothing when attachments array is empty', () => {
    const onRemove = vi.fn();
    const { container } = render(
      <AttachmentPreview attachments={[]} onRemove={onRemove} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders image attachment with preview', () => {
    const onRemove = vi.fn();
    const attachments = [createImageAttachment('1', 'test.png')];
    
    render(<AttachmentPreview attachments={attachments} onRemove={onRemove} />);
    
    const img = screen.getByRole('img', { name: 'test.png' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('renders file attachment with filename and size', () => {
    const onRemove = vi.fn();
    const attachments = [createFileAttachment('1', 'document.pdf')];
    
    render(<AttachmentPreview attachments={attachments} onRemove={onRemove} />);
    
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('renders multiple attachments', () => {
    const onRemove = vi.fn();
    const attachments = [
      createImageAttachment('1', 'image1.png'),
      createImageAttachment('2', 'image2.png'),
      createFileAttachment('3', 'doc.pdf'),
    ];
    
    render(<AttachmentPreview attachments={attachments} onRemove={onRemove} />);
    
    expect(screen.getByRole('img', { name: 'image1.png' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'image2.png' })).toBeInTheDocument();
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();
  });

  it('calls onRemove with attachment id when remove button clicked', () => {
    const onRemove = vi.fn();
    const attachments = [createImageAttachment('test-id', 'test.png')];
    
    render(<AttachmentPreview attachments={attachments} onRemove={onRemove} />);
    
    const removeButton = screen.getByRole('button', { name: /remove test.png/i });
    fireEvent.click(removeButton);
    
    expect(onRemove).toHaveBeenCalledWith('test-id');
  });

  it('disables remove buttons when disabled prop is true', () => {
    const onRemove = vi.fn();
    const attachments = [createImageAttachment('1', 'test.png')];
    
    render(
      <AttachmentPreview attachments={attachments} onRemove={onRemove} disabled />
    );
    
    const removeButton = screen.getByRole('button', { name: /remove test.png/i });
    expect(removeButton).toBeDisabled();
  });

  it('renders different file types with appropriate icons', () => {
    const onRemove = vi.fn();
    const attachments = [
      createFileAttachment('1', 'data.csv', 'text/csv'),
      createFileAttachment('2', 'config.json', 'application/json'),
      createFileAttachment('3', 'script.py', 'text/x-python'),
    ];
    
    render(<AttachmentPreview attachments={attachments} onRemove={onRemove} />);
    
    // All files should render with their names
    expect(screen.getByText('data.csv')).toBeInTheDocument();
    expect(screen.getByText('config.json')).toBeInTheDocument();
    expect(screen.getByText('script.py')).toBeInTheDocument();
  });
});
