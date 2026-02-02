/**
 * Tests for McpServerSettings component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { McpServerSettings } from './McpServerSettings';
import type { McpServerConfig } from '../../types';

describe('McpServerSettings', () => {
  const mockOnUpdateServers = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no servers configured', () => {
    render(
      <McpServerSettings servers={[]} onUpdateServers={mockOnUpdateServers} />
    );

    expect(screen.getByText(/No MCP servers configured/i)).toBeInTheDocument();
    expect(screen.getByText(/Add MCP Server/i)).toBeInTheDocument();
  });

  it('displays configured servers', () => {
    const servers: McpServerConfig[] = [
      {
        id: '1',
        name: 'GitHub MCP',
        serverLabel: 'github',
        serverUrl: 'https://gitmcp.io/example',
        requireApproval: 'never',
        headers: [],
        enabled: true,
      },
    ];

    render(
      <McpServerSettings
        servers={servers}
        onUpdateServers={mockOnUpdateServers}
      />
    );

    expect(screen.getByText('GitHub MCP')).toBeInTheDocument();
  });

  it('allows toggling server enabled state', () => {
    const servers: McpServerConfig[] = [
      {
        id: '1',
        name: 'Test Server',
        serverLabel: 'test',
        serverUrl: 'https://test.com',
        requireApproval: 'never',
        headers: [],
        enabled: true,
      },
    ];

    render(
      <McpServerSettings
        servers={servers}
        onUpdateServers={mockOnUpdateServers}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: /Enable Test Server/i });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    expect(mockOnUpdateServers).toHaveBeenCalledWith([
      expect.objectContaining({ id: '1', enabled: false }),
    ]);
  });

  it('opens add new server form when clicking add button', () => {
    render(
      <McpServerSettings servers={[]} onUpdateServers={mockOnUpdateServers} />
    );

    const addButton = screen.getByText(/Add MCP Server/i);
    fireEvent.click(addButton);

    expect(screen.getByText('Add New MCP Server')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('My MCP Server')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('github')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com/mcp')).toBeInTheDocument();
  });

  it('disables save button when required fields are empty', () => {
    render(
      <McpServerSettings servers={[]} onUpdateServers={mockOnUpdateServers} />
    );

    fireEvent.click(screen.getByText(/Add MCP Server/i));

    const saveButton = screen.getByText('Add Server');
    expect(saveButton).toBeDisabled();
  });

  it('saves new server when form is complete', () => {
    render(
      <McpServerSettings servers={[]} onUpdateServers={mockOnUpdateServers} />
    );

    fireEvent.click(screen.getByText(/Add MCP Server/i));

    fireEvent.change(screen.getByPlaceholderText('My MCP Server'), {
      target: { value: 'New Server' },
    });
    fireEvent.change(screen.getByPlaceholderText('github'), {
      target: { value: 'new-label' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/mcp'), {
      target: { value: 'https://new.example.com' },
    });

    const saveButton = screen.getByText('Add Server');
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    expect(mockOnUpdateServers).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'New Server',
        serverLabel: 'new-label',
        serverUrl: 'https://new.example.com',
        requireApproval: 'never',
        headers: [],
        enabled: true,
      }),
    ]);
  });

  it('cancels adding new server', () => {
    render(
      <McpServerSettings servers={[]} onUpdateServers={mockOnUpdateServers} />
    );

    fireEvent.click(screen.getByText(/Add MCP Server/i));
    expect(screen.getByText('Add New MCP Server')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add New MCP Server')).not.toBeInTheDocument();
  });

  it('deletes a server', () => {
    const servers: McpServerConfig[] = [
      {
        id: '1',
        name: 'To Delete',
        serverLabel: 'delete',
        serverUrl: 'https://delete.com',
        requireApproval: 'never',
        headers: [],
        enabled: true,
      },
    ];

    render(
      <McpServerSettings
        servers={servers}
        onUpdateServers={mockOnUpdateServers}
      />
    );

    const deleteButton = screen.getByRole('button', { name: /Delete server/i });
    fireEvent.click(deleteButton);

    expect(mockOnUpdateServers).toHaveBeenCalledWith([]);
  });

  it('expands server to show edit form', () => {
    const servers: McpServerConfig[] = [
      {
        id: '1',
        name: 'Expandable',
        serverLabel: 'expand',
        serverUrl: 'https://expand.com',
        requireApproval: 'never',
        headers: [],
        enabled: true,
      },
    ];

    render(
      <McpServerSettings
        servers={servers}
        onUpdateServers={mockOnUpdateServers}
      />
    );

    // Click on the server card header to expand
    const expandButton = screen.getByRole('button', { name: /Expand/i });
    fireEvent.click(expandButton);

    // Form fields should now be visible
    expect(screen.getByDisplayValue('Expandable')).toBeInTheDocument();
    expect(screen.getByDisplayValue('expand')).toBeInTheDocument();
  });

  it('enforces maximum server limit', () => {
    const servers: McpServerConfig[] = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      name: `Server ${i}`,
      serverLabel: `server${i}`,
      serverUrl: `https://server${i}.com`,
      requireApproval: 'never' as const,
      headers: [],
      enabled: true,
    }));

    render(
      <McpServerSettings
        servers={servers}
        onUpdateServers={mockOnUpdateServers}
      />
    );

    const addButton = screen.getByText(/Add MCP Server/i);
    expect(addButton).toBeDisabled();
    expect(screen.getByText(/Maximum of 5 servers reached/i)).toBeInTheDocument();
  });

  it('allows adding custom headers', () => {
    render(
      <McpServerSettings servers={[]} onUpdateServers={mockOnUpdateServers} />
    );

    fireEvent.click(screen.getByText(/Add MCP Server/i));

    // Add a header
    fireEvent.click(screen.getByText('+ Add Header'));

    // Header inputs should appear
    const headerInputs = screen.getAllByPlaceholderText('Header name');
    expect(headerInputs.length).toBe(1);

    // Fill in header values
    fireEvent.change(screen.getByPlaceholderText('Header name'), {
      target: { value: 'Authorization' },
    });
    fireEvent.change(screen.getByPlaceholderText('Header value'), {
      target: { value: 'Bearer token123' },
    });

    // Complete the form
    fireEvent.change(screen.getByPlaceholderText('My MCP Server'), {
      target: { value: 'Server with Header' },
    });
    fireEvent.change(screen.getByPlaceholderText('github'), {
      target: { value: 'auth-server' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/mcp'), {
      target: { value: 'https://auth.example.com' },
    });

    fireEvent.click(screen.getByText('Add Server'));

    expect(mockOnUpdateServers).toHaveBeenCalledWith([
      expect.objectContaining({
        headers: [{ key: 'Authorization', value: 'Bearer token123' }],
      }),
    ]);
  });
});
