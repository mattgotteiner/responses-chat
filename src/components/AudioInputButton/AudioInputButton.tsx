import './AudioInputButton.css';

interface AudioInputButtonProps {
  /** Whether the Web Speech API is supported in the current browser */
  isSupported: boolean;
  /** Whether speech recognition is currently active */
  isRecording: boolean;
  /** Whether the button should be disabled */
  disabled: boolean;
  /** Click handler — toggles recording on/off */
  onClick: () => void;
}

/**
 * Microphone button that triggers browser-native speech-to-text.
 * Renders nothing when the Web Speech API is unavailable.
 */
export function AudioInputButton({ isSupported, isRecording, disabled, onClick }: AudioInputButtonProps) {
  if (!isSupported) return null;

  const label = isRecording ? 'Stop voice input' : 'Start voice input';

  return (
    <button
      className={`audio-input-button${isRecording ? ' audio-input-button--recording' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      type="button"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
