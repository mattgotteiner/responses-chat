import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JsonSidePanel } from './JsonSidePanel';

describe('JsonSidePanel', () => {
  const mockOnClose = vi.fn();
  const sampleData = {
    title: 'Test JSON',
    data: { foo: 'bar', count: 42 },
  };

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <JsonSidePanel isOpen={false} onClose={mockOnClose} panelData={sampleData} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when panelData is null', () => {
    const { container } = render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders panel with title when open', () => {
    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    expect(screen.getByText('Test JSON')).toBeInTheDocument();
  });

  it('displays formatted JSON content', () => {
    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    const jsonContent = screen.getByText(/"foo": "bar"/);
    expect(jsonContent).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay clicked', () => {
    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    const overlay = document.querySelector('.json-panel-overlay');
    fireEvent.click(overlay!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when panel content clicked', () => {
    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    const panel = document.querySelector('.json-side-panel');
    fireEvent.click(panel!);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('has copy button', () => {
    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    expect(screen.getByLabelText('Copy JSON')).toBeInTheDocument();
  });

  it('copies JSON to clipboard when copy button clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(
      <JsonSidePanel isOpen={true} onClose={mockOnClose} panelData={sampleData} />
    );
    fireEvent.click(screen.getByLabelText('Copy JSON'));

    await vi.waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        JSON.stringify(sampleData.data, null, 2)
      );
    });
  });
});
