/**
 * Tests for SettingsSidebar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsSidebar } from './SettingsSidebar';
import { DEFAULT_SETTINGS } from '../../types';
import type { Settings } from '../../types';

describe('SettingsSidebar', () => {
  const mockOnClose = vi.fn();
  const mockOnUpdateSettings = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    settings: { ...DEFAULT_SETTINGS },
    onUpdateSettings: mockOnUpdateSettings,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsSidebar {...defaultProps} isOpen={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the sidebar when isOpen is true', () => {
    render(<SettingsSidebar {...defaultProps} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<SettingsSidebar {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Close settings'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    render(<SettingsSidebar {...defaultProps} />);
    const overlay = document.querySelector('.settings-overlay');
    fireEvent.click(overlay!);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  describe('Web Search Toggle', () => {
    it('renders the web search checkbox in the Tools section', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('Web Search')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /web search/i })).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /web search/i });
      expect(checkbox).not.toBeChecked();
    });

    it('checkbox is checked when webSearchEnabled is true', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, webSearchEnabled: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const checkbox = screen.getByRole('checkbox', { name: /web search/i });
      expect(checkbox).toBeChecked();
    });

    it('calls onUpdateSettings with webSearchEnabled: true when checkbox is checked', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /web search/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ webSearchEnabled: true });
    });

    it('calls onUpdateSettings with webSearchEnabled: false when checkbox is unchecked', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, webSearchEnabled: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const checkbox = screen.getByRole('checkbox', { name: /web search/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ webSearchEnabled: false });
    });

    it('displays hint text about Bing and costs', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(
        screen.getByText(/ground responses with real-time web data via bing/i)
      ).toBeInTheDocument();
    });
  });

  describe('Code Interpreter Toggle', () => {
    it('renders the code interpreter checkbox in the Tools section', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('Code Interpreter')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /code interpreter/i })).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /code interpreter/i });
      expect(checkbox).not.toBeChecked();
    });

    it('checkbox is checked when codeInterpreterEnabled is true', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, codeInterpreterEnabled: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const checkbox = screen.getByRole('checkbox', { name: /code interpreter/i });
      expect(checkbox).toBeChecked();
    });

    it('calls onUpdateSettings with codeInterpreterEnabled: true when checkbox is checked', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /code interpreter/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ codeInterpreterEnabled: true });
    });

    it('calls onUpdateSettings with codeInterpreterEnabled: false when checkbox is unchecked', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, codeInterpreterEnabled: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const checkbox = screen.getByRole('checkbox', { name: /code interpreter/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ codeInterpreterEnabled: false });
    });

    it('displays hint text about Python execution and costs', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(
        screen.getByText(/execute python code in a sandboxed environment/i)
      ).toBeInTheDocument();
    });
  });

  describe('Required Fields', () => {
    it('renders endpoint input', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Endpoint URL')).toBeInTheDocument();
    });

    it('renders API key input', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('API Key')).toBeInTheDocument();
    });

    it('renders model select', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Model')).toBeInTheDocument();
    });

    it('renders deployment name input', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Deployment Name')).toBeInTheDocument();
    });
  });

  describe('Optional Fields', () => {
    it('renders reasoning effort select', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Reasoning Effort')).toBeInTheDocument();
    });

    it('renders verbosity select', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Verbosity')).toBeInTheDocument();
    });

    it('renders developer instructions textarea', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByLabelText('Developer Instructions')).toBeInTheDocument();
    });
  });
});
