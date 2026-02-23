import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioInputButton } from './AudioInputButton';

describe('AudioInputButton', () => {
  const mockOnClick = vi.fn();

  it('renders nothing when isSupported is false', () => {
    const { container } = render(
      <AudioInputButton isSupported={false} isRecording={false} disabled={false} onClick={mockOnClick} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a button when isSupported is true', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={false} disabled={false} onClick={mockOnClick} />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows "Start voice input" label when not recording', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={false} disabled={false} onClick={mockOnClick} />,
    );
    expect(screen.getByLabelText('Start voice input')).toBeInTheDocument();
  });

  it('shows "Stop voice input" label when recording', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={true} disabled={false} onClick={mockOnClick} />,
    );
    expect(screen.getByLabelText('Stop voice input')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={false} disabled={false} onClick={mockOnClick} />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={false} disabled={true} onClick={mockOnClick} />,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies recording CSS modifier class when recording', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={true} disabled={false} onClick={mockOnClick} />,
    );
    expect(screen.getByRole('button')).toHaveClass('audio-input-button--recording');
  });

  it('does not apply recording class when not recording', () => {
    render(
      <AudioInputButton isSupported={true} isRecording={false} disabled={false} onClick={mockOnClick} />,
    );
    expect(screen.getByRole('button')).not.toHaveClass('audio-input-button--recording');
  });
});
