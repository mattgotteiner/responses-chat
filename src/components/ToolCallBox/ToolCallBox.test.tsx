import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  describe('code interpreter calls', () => {
    const codeInterpreterCall: ToolCall = {
      id: 'ci-1',
      name: 'code_interpreter',
      type: 'code_interpreter',
      arguments: '',
      status: 'completed',
      code: 'print(2 + 2)',
      output: '4',
    };

    it('renders code interpreter label', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      expect(screen.getByText('Code Interpreter')).toBeInTheDocument();
    });

    it('renders python icon for code interpreter', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      expect(screen.getByText('🐍')).toBeInTheDocument();
    });

    it('renders Python label when expanded', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('renders the code when expanded', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('print(2 + 2)')).toBeInTheDocument();
    });

    it('renders the output when expanded', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Output')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('is collapsed by default', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      expect(screen.queryByText('Python')).not.toBeInTheDocument();
      expect(screen.queryByText('print(2 + 2)')).not.toBeInTheDocument();
    });

    it('renders chevron indicator', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('renders complete status', () => {
      render(<ToolCallBox toolCall={codeInterpreterCall} />);
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('renders interpreting status', () => {
      const interpretingCall: ToolCall = {
        ...codeInterpreterCall,
        status: 'interpreting',
      };
      render(<ToolCallBox toolCall={interpretingCall} />);
      expect(screen.getByText('Executing...')).toBeInTheDocument();
    });

    it('renders in_progress status', () => {
      const inProgressCall: ToolCall = {
        ...codeInterpreterCall,
        status: 'in_progress',
      };
      render(<ToolCallBox toolCall={inProgressCall} />);
      expect(screen.getByText('Running...')).toBeInTheDocument();
    });

    it('applies code interpreter CSS class', () => {
      const { container } = render(<ToolCallBox toolCall={codeInterpreterCall} />);
      expect(container.querySelector('.tool-call-box--code-interpreter')).toBeInTheDocument();
    });

    it('does not render output section when output is absent', () => {
      const callWithoutOutput: ToolCall = {
        ...codeInterpreterCall,
        output: undefined,
      };
      render(<ToolCallBox toolCall={callWithoutOutput} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByText('Output')).not.toBeInTheDocument();
    });

    it('does not render code section when code is absent', () => {
      const callWithoutCode: ToolCall = {
        ...codeInterpreterCall,
        code: undefined,
      };
      render(<ToolCallBox toolCall={callWithoutCode} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByText('Python')).not.toBeInTheDocument();
    });
  });
});
