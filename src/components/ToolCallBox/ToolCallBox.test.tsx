import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallBox } from './ToolCallBox';
import type { ToolCall } from '../../types';

describe('ToolCallBox', () => {
  const baseToolCall: ToolCall = {
    id: 'call-1',
    name: 'get_weather',
    arguments: '{"location": "Seattle"}',
  };

  it('renders tool name', () => {
    render(<ToolCallBox toolCall={baseToolCall} />);
    expect(screen.getByText('get_weather')).toBeInTheDocument();
  });

  it('renders tool icon', () => {
    render(<ToolCallBox toolCall={baseToolCall} />);
    expect(screen.getByText('🔧')).toBeInTheDocument();
  });

  it('formats valid JSON arguments', () => {
    render(<ToolCallBox toolCall={baseToolCall} />);
    // JSON should be formatted with indentation
    const pre = screen.getByText(/location/);
    expect(pre).toBeInTheDocument();
  });

  it('renders non-JSON arguments as-is', () => {
    const toolCallWithBadJson: ToolCall = {
      ...baseToolCall,
      arguments: 'not valid json',
    };
    render(<ToolCallBox toolCall={toolCallWithBadJson} />);
    expect(screen.getByText('not valid json')).toBeInTheDocument();
  });

  it('renders result when present', () => {
    const toolCallWithResult: ToolCall = {
      ...baseToolCall,
      result: 'Sunny, 72°F',
    };
    render(<ToolCallBox toolCall={toolCallWithResult} />);
    expect(screen.getByText('Result:')).toBeInTheDocument();
    expect(screen.getByText('Sunny, 72°F')).toBeInTheDocument();
  });

  it('does not render result section when result is absent', () => {
    render(<ToolCallBox toolCall={baseToolCall} />);
    expect(screen.queryByText('Result:')).not.toBeInTheDocument();
  });
});
