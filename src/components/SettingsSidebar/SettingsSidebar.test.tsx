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
  const mockOnClearStoredData = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    settings: { ...DEFAULT_SETTINGS },
    onUpdateSettings: mockOnUpdateSettings,
    onClearStoredData: mockOnClearStoredData,
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

  describe('Theme Settings', () => {
    it('renders the theme options in the Appearance section', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Theme')).toBeInTheDocument();
      expect(screen.getByLabelText('Light')).toBeInTheDocument();
      expect(screen.getByLabelText('Dark')).toBeInTheDocument();
      expect(screen.getByLabelText('System')).toBeInTheDocument();
    });

    it('has correct option checked based on current theme setting', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, theme: 'dark' };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      expect(screen.getByLabelText('Dark')).toBeChecked();
      expect(screen.getByLabelText('Light')).not.toBeChecked();
      expect(screen.getByLabelText('System')).not.toBeChecked();
    });

    it('calls onUpdateSettings with theme: light when Light is selected', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, theme: 'dark' };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      fireEvent.click(screen.getByLabelText('Light'));
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ theme: 'light' });
    });

    it('calls onUpdateSettings with theme: dark when Dark is selected', () => {
      render(<SettingsSidebar {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Dark'));
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ theme: 'dark' });
    });

    it('calls onUpdateSettings with theme: system when System is selected', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, theme: 'dark' };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      fireEvent.click(screen.getByLabelText('System'));
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ theme: 'system' });
    });
  });

  describe('API Limits', () => {
    it('renders the API Limits section', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText('API Limits')).toBeInTheDocument();
    });

    it('renders max output tokens checkbox', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText('Limit Max Output Tokens')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /limit max output tokens/i })).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /limit max output tokens/i });
      expect(checkbox).not.toBeChecked();
    });

    it('does not show slider when checkbox is unchecked', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('shows slider when checkbox is checked', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, maxOutputTokensEnabled: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('calls onUpdateSettings with maxOutputTokensEnabled: true when checkbox is checked', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /limit max output tokens/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ maxOutputTokensEnabled: true });
    });

    it('calls onUpdateSettings with maxOutputTokensEnabled: false when checkbox is unchecked', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, maxOutputTokensEnabled: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const checkbox = screen.getByRole('checkbox', { name: /limit max output tokens/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ maxOutputTokensEnabled: false });
    });

    it('slider shows current maxOutputTokens value', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, maxOutputTokensEnabled: true, maxOutputTokens: 32000 };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const slider = screen.getByRole('slider');
      expect(slider).toHaveValue('32000');
    });

    it('displays current token value in label', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, maxOutputTokensEnabled: true, maxOutputTokens: 32000 };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      expect(screen.getByText(/Max Output Tokens: 32,000/)).toBeInTheDocument();
    });

    it('calls onUpdateSettings with maxOutputTokens when slider is changed', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, maxOutputTokensEnabled: true, maxOutputTokens: 16000 };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '64000' } });
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ maxOutputTokens: 64000 });
    });

    it('displays hint text about null behavior', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(
        screen.getByText(/when disabled, no limit is sent/i)
      ).toBeInTheDocument();
    });
  });

  describe('Storage Settings', () => {
    it('renders the Storage section at the top', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText('Storage')).toBeInTheDocument();
    });

    it('renders the noLocalStorage checkbox', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByText("Don't save settings")).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /don't save settings/i });
      expect(checkbox).not.toBeChecked();
    });

    it('checkbox is checked when noLocalStorage is true', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, noLocalStorage: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      const checkbox = screen.getByRole('checkbox', { name: /don't save settings/i });
      expect(checkbox).toBeChecked();
    });

    it('calls onUpdateSettings with noLocalStorage: true when checkbox is checked', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const checkbox = screen.getByRole('checkbox', { name: /don't save settings/i });
      fireEvent.click(checkbox);
      expect(mockOnUpdateSettings).toHaveBeenCalledWith({ noLocalStorage: true });
    });

    it('renders Clear Saved Data button', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(screen.getByRole('button', { name: /clear saved data/i })).toBeInTheDocument();
    });

    it('calls onClearStoredData when Clear Saved Data button is clicked', () => {
      render(<SettingsSidebar {...defaultProps} />);
      const button = screen.getByRole('button', { name: /clear saved data/i });
      fireEvent.click(button);
      expect(mockOnClearStoredData).toHaveBeenCalledTimes(1);
    });

    it('displays hint text about session behavior', () => {
      render(<SettingsSidebar {...defaultProps} />);
      expect(
        screen.getByText(/settings are not saved and must be re-entered each session/i)
      ).toBeInTheDocument();
    });
  });

  describe('API Key Hint Text', () => {
    it('shows warning message when noLocalStorage is false', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, noLocalStorage: false };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      expect(
        screen.getByText(/stored in browser localStorage \(unencrypted\)/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/storage disabled/i)).not.toBeInTheDocument();
    });

    it('shows "Storage disabled" message when noLocalStorage is true', () => {
      const settings: Settings = { ...DEFAULT_SETTINGS, noLocalStorage: true };
      render(<SettingsSidebar {...defaultProps} settings={settings} />);
      expect(
        screen.getByText(/storage disabled — credentials will not be saved/i)
      ).toBeInTheDocument();
      expect(screen.queryByText(/stored in browser localStorage/i)).not.toBeInTheDocument();
    });
  });
});
