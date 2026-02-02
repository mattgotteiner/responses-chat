import { describe, it, expect, vi } from 'vitest';
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

  describe('MCP calls', () => {
    const mcpCall: ToolCall = {
      id: 'mcp-1',
      name: 'mslearn/microsoft_docs_search',
      type: 'mcp',
      arguments: '{"query": "What is Azure?"}',
      status: 'completed',
    };

    it('renders MCP tool name', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      expect(screen.getByText('mslearn/microsoft_docs_search')).toBeInTheDocument();
    });

    it('renders MCP icon', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      expect(screen.getByText('🔌')).toBeInTheDocument();
    });

    it('renders completed status', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('renders in_progress status', () => {
      const inProgressCall: ToolCall = {
        ...mcpCall,
        status: 'in_progress',
      };
      render(<ToolCallBox toolCall={inProgressCall} />);
      expect(screen.getByText('Calling...')).toBeInTheDocument();
    });

    it('is collapsed by default', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      expect(screen.queryByText('Arguments')).not.toBeInTheDocument();
    });

    it('renders arguments label when expanded', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Arguments')).toBeInTheDocument();
    });

    it('formats JSON arguments when expanded', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      fireEvent.click(screen.getByRole('button'));
      // Should be formatted with proper indentation
      expect(screen.getByText(/"query": "What is Azure\?"/)).toBeInTheDocument();
    });

    it('renders non-JSON arguments as-is when expanded', () => {
      const mcpCallWithBadJson: ToolCall = {
        ...mcpCall,
        arguments: 'not valid json',
      };
      render(<ToolCallBox toolCall={mcpCallWithBadJson} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('not valid json')).toBeInTheDocument();
    });

    it('renders result when present and expanded', () => {
      const mcpCallWithResult: ToolCall = {
        ...mcpCall,
        result: 'Azure is a cloud computing platform...',
      };
      render(<ToolCallBox toolCall={mcpCallWithResult} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText('Result:')).toBeInTheDocument();
      expect(screen.getByText('Azure is a cloud computing platform...')).toBeInTheDocument();
    });

    it('renders chevron indicator', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      expect(screen.getByText('▶')).toBeInTheDocument();
    });

    it('applies MCP CSS class', () => {
      const { container } = render(<ToolCallBox toolCall={mcpCall} />);
      expect(container.querySelector('.tool-call-box--mcp')).toBeInTheDocument();
    });

    it('does not render result section when result is absent', () => {
      render(<ToolCallBox toolCall={mcpCall} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByText('Result:')).not.toBeInTheDocument();
    });
  });

  describe('aborted status', () => {
    it('renders aborted status for web search', () => {
      const abortedWebSearch: ToolCall = {
        id: 'ws-aborted',
        name: 'web_search',
        type: 'web_search',
        arguments: '',
        status: 'aborted',
      };
      render(<ToolCallBox toolCall={abortedWebSearch} />);
      expect(screen.getByText('Aborted')).toBeInTheDocument();
    });

    it('renders aborted status for code interpreter', () => {
      const abortedCodeInterpreter: ToolCall = {
        id: 'ci-aborted',
        name: 'code_interpreter',
        type: 'code_interpreter',
        arguments: '',
        status: 'aborted',
        code: 'print("test")',
      };
      render(<ToolCallBox toolCall={abortedCodeInterpreter} />);
      expect(screen.getByText('Aborted')).toBeInTheDocument();
    });

    it('renders aborted status for MCP', () => {
      const abortedMcp: ToolCall = {
        id: 'mcp-aborted',
        name: 'mslearn/tool',
        type: 'mcp',
        arguments: '{}',
        status: 'aborted',
      };
      render(<ToolCallBox toolCall={abortedMcp} />);
      expect(screen.getByText('Aborted')).toBeInTheDocument();
    });

    it('applies aborted CSS class', () => {
      const abortedCall: ToolCall = {
        id: 'mcp-aborted',
        name: 'mslearn/tool',
        type: 'mcp',
        arguments: '{}',
        status: 'aborted',
      };
      const { container } = render(<ToolCallBox toolCall={abortedCall} />);
      expect(container.querySelector('.tool-call-box--aborted')).toBeInTheDocument();
    });

    it('applies aborted class instead of type-specific class when aborted', () => {
      const abortedWebSearch: ToolCall = {
        id: 'ws-aborted',
        name: 'web_search',
        type: 'web_search',
        arguments: '',
        status: 'aborted',
      };
      const { container } = render(<ToolCallBox toolCall={abortedWebSearch} />);
      // Should have aborted class, not web-search class
      expect(container.querySelector('.tool-call-box--aborted')).toBeInTheDocument();
      expect(container.querySelector('.tool-call-box--web-search')).not.toBeInTheDocument();
    });
  });

  describe('MCP approval calls', () => {
    const mcpApprovalCall: ToolCall = {
      id: 'mcp-approval-1',
      name: 'mslearn/microsoft_docs_search',
      type: 'mcp_approval',
      arguments: '{"query": "Azure AI Foundry"}',
      status: 'pending_approval',
      serverLabel: 'mslearn',
      approvalRequestId: 'mcpr_abc123',
    };

    it('renders MCP approval tool name', () => {
      render(<ToolCallBox toolCall={mcpApprovalCall} />);
      expect(screen.getByText('mslearn/microsoft_docs_search')).toBeInTheDocument();
    });

    it('renders warning icon for approval request', () => {
      render(<ToolCallBox toolCall={mcpApprovalCall} />);
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('renders pending approval status', () => {
      render(<ToolCallBox toolCall={mcpApprovalCall} />);
      expect(screen.getByText('Approval Required')).toBeInTheDocument();
    });

    it('is expanded by default when pending approval', () => {
      render(<ToolCallBox toolCall={mcpApprovalCall} />);
      // Should show arguments immediately
      expect(screen.getByText('Arguments')).toBeInTheDocument();
    });

    it('shows approve and deny buttons when pending', () => {
      render(<ToolCallBox toolCall={mcpApprovalCall} />);
      expect(screen.getByText('✓ Approve')).toBeInTheDocument();
      expect(screen.getByText('✕ Deny')).toBeInTheDocument();
    });

    it('calls onApprove with approvalRequestId when approve is clicked', () => {
      const handleApprove = vi.fn();
      render(<ToolCallBox toolCall={mcpApprovalCall} onApprove={handleApprove} />);
      fireEvent.click(screen.getByText('✓ Approve'));
      expect(handleApprove).toHaveBeenCalledWith('mcpr_abc123');
    });

    it('calls onDeny with approvalRequestId when deny is clicked', () => {
      const handleDeny = vi.fn();
      render(<ToolCallBox toolCall={mcpApprovalCall} onDeny={handleDeny} />);
      fireEvent.click(screen.getByText('✕ Deny'));
      expect(handleDeny).toHaveBeenCalledWith('mcpr_abc123');
    });

    it('shows approved status and hides buttons when approved', () => {
      const approvedCall: ToolCall = {
        ...mcpApprovalCall,
        status: 'approved',
      };
      render(<ToolCallBox toolCall={approvedCall} />);
      expect(screen.getByText('Approved')).toBeInTheDocument();
      expect(screen.getByText('✓ Tool call approved')).toBeInTheDocument();
      expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('✕ Deny')).not.toBeInTheDocument();
    });

    it('shows denied status and hides buttons when denied', () => {
      const deniedCall: ToolCall = {
        ...mcpApprovalCall,
        status: 'denied',
      };
      render(<ToolCallBox toolCall={deniedCall} />);
      expect(screen.getByText('Denied')).toBeInTheDocument();
      expect(screen.getByText('✕ Tool call denied by user')).toBeInTheDocument();
      expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('✕ Deny')).not.toBeInTheDocument();
    });

    it('applies pending-approval CSS class', () => {
      const { container } = render(<ToolCallBox toolCall={mcpApprovalCall} />);
      expect(container.querySelector('.tool-call-box--pending-approval')).toBeInTheDocument();
    });

    it('formats JSON arguments', () => {
      render(<ToolCallBox toolCall={mcpApprovalCall} />);
      // JSON should be formatted with proper keys
      expect(screen.getByText(/"query": "Azure AI Foundry"/)).toBeInTheDocument();
    });

    it('renders non-JSON arguments as-is', () => {
      const callWithBadJson: ToolCall = {
        ...mcpApprovalCall,
        arguments: 'not valid json',
      };
      render(<ToolCallBox toolCall={callWithBadJson} />);
      expect(screen.getByText('not valid json')).toBeInTheDocument();
    });

    it('does not call handlers if approvalRequestId is missing', () => {
      const callWithoutId: ToolCall = {
        ...mcpApprovalCall,
        approvalRequestId: undefined,
      };
      const handleApprove = vi.fn();
      const handleDeny = vi.fn();
      render(<ToolCallBox toolCall={callWithoutId} onApprove={handleApprove} onDeny={handleDeny} />);
      fireEvent.click(screen.getByText('✓ Approve'));
      fireEvent.click(screen.getByText('✕ Deny'));
      expect(handleApprove).not.toHaveBeenCalled();
      expect(handleDeny).not.toHaveBeenCalled();
    });
  });
});
