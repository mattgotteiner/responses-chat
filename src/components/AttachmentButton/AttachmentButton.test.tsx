/**
 * Tests for AttachmentButton component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentButton } from './AttachmentButton';

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
});
