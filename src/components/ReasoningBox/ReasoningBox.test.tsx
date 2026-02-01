import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReasoningBox } from './ReasoningBox';
import type { ReasoningStep } from '../../types';

describe('ReasoningBox', () => {
  const sampleReasoning: ReasoningStep[] = [
    { id: 'step-1', content: 'First I need to analyze the problem' },
    { id: 'step-2', content: 'Then I will formulate a response' },
  ];

  it('renders with reasoning header', () => {
    render(<ReasoningBox reasoning={sampleReasoning} />);
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
  });

  it('is collapsed by default', () => {
    render(<ReasoningBox reasoning={sampleReasoning} />);
    expect(screen.queryByText('First I need to analyze the problem')).not.toBeInTheDocument();
  });

  it('expands when header is clicked', () => {
    render(<ReasoningBox reasoning={sampleReasoning} />);
    
    fireEvent.click(screen.getByRole('button'));
    
    expect(screen.getByText('First I need to analyze the problem')).toBeInTheDocument();
    expect(screen.getByText('Then I will formulate a response')).toBeInTheDocument();
  });

  it('collapses when clicked again', () => {
    render(<ReasoningBox reasoning={sampleReasoning} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button); // expand
    fireEvent.click(button); // collapse
    
    expect(screen.queryByText('First I need to analyze the problem')).not.toBeInTheDocument();
  });

  it('shows streaming indicator when isStreaming is true', () => {
    render(<ReasoningBox reasoning={sampleReasoning} isStreaming />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('returns null when reasoning is empty and not streaming', () => {
    const { container } = render(<ReasoningBox reasoning={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when streaming even with empty reasoning', () => {
    render(<ReasoningBox reasoning={[]} isStreaming />);
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
  });

  it('sets aria-expanded attribute correctly', () => {
    render(<ReasoningBox reasoning={sampleReasoning} />);
    const button = screen.getByRole('button');
    
    expect(button).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });
});
