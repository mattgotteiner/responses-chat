import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallBox } from './ToolCallBox';
import type { ToolCall } from '../../types';

describe('ToolCallBox', () => {
  const baseToolCall: ToolCall = {
    id: 'call-1',
    name: 'get_weather',
    type: 'function',
    arguments: '{"location": "Seattle"}',
  };

  describe('function calls', () => {
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

  describe('web search calls', () => {
    const webSearchCall: ToolCall = {
      id: 'ws-1',
      name: 'web_search',
      type: 'web_search',
      arguments: '{"query": "Paris overview"}',
      status: 'completed',
      query: 'Paris overview',
    };

    it('renders web search label', () => {
      render(<ToolCallBox toolCall={webSearchCall} />);
      expect(screen.getByText('Web Search')).toBeInTheDocument();
    });

    it('renders search icon for web search', () => {
      render(<ToolCallBox toolCall={webSearchCall} />);
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('renders search query', () => {
      render(<ToolCallBox toolCall={webSearchCall} />);
      expect(screen.getByText('Paris overview')).toBeInTheDocument();
      expect(screen.getByText('Query:')).toBeInTheDocument();
    });

    it('renders completed status', () => {
      render(<ToolCallBox toolCall={webSearchCall} />);
      expect(screen.getByText('Search complete')).toBeInTheDocument();
    });

    it('renders searching status', () => {
      const searchingCall: ToolCall = {
        ...webSearchCall,
        status: 'searching',
      };
      render(<ToolCallBox toolCall={searchingCall} />);
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    it('renders in_progress status', () => {
      const inProgressCall: ToolCall = {
        ...webSearchCall,
        status: 'in_progress',
      };
      render(<ToolCallBox toolCall={inProgressCall} />);
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    it('applies web search CSS class', () => {
      const { container } = render(<ToolCallBox toolCall={webSearchCall} />);
      expect(container.querySelector('.tool-call-box--web-search')).toBeInTheDocument();
    });
  });
});
