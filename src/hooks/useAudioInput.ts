import { useState, useCallback, useRef, useEffect } from 'react';

// Minimal types for the Web Speech API (not in TypeScript's DOM lib)
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent {
  readonly error: string;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/**
 * Joins two strings with a single space, unless either is empty or the
 * join point already has a space.
 */
function joinWithSpace(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  if (a.endsWith(' ') || b.startsWith(' ')) return a + b;
  return `${a} ${b}`;
}

export interface UseAudioInputReturn {
  /** Whether the Web Speech API is available in the current browser */
  isSupported: boolean;
  /** Whether speech recognition is currently active */
  isRecording: boolean;
  /** Last error message, if any */
  error: string | null;
  /**
   * Start recording. `baseText` is the text already in the input box at the
   * moment recording begins; `onTranscript` is called with the full
   * (base + transcription) string on every recognition event.
   */
  start: (baseText: string, onTranscript: (transcript: string) => void) => void;
  /** Stop recording */
  stop: () => void;
}

/**
 * React hook that provides browser-native speech-to-text via the Web Speech API.
 *
 * Handles continuous recording (including iOS Safari's auto-restart workaround),
 * accumulates final transcripts across recognition restarts, and merges interim
 * results with previously committed text.
 *
 * @returns {UseAudioInputReturn} Recording controls and state.
 *
 * @example
 * ```tsx
 * import { useRef } from 'react';
 * import { useAudioInput } from '../hooks/useAudioInput';
 *
 * function VoiceInput() {
 *   const [value, setValue] = useState('');
 *   const valueRef = useRef(value);
 *   useEffect(() => { valueRef.current = value; }, [value]);
 *
 *   const { isSupported, isRecording, start, stop } = useAudioInput();
 *
 *   const toggle = () => {
 *     if (isRecording) {
 *       stop();
 *     } else {
 *       start(value, (transcript) => setValue(transcript));
 *     }
 *   };
 *
 *   return <input value={value} onChange={(e) => setValue(e.target.value)} />;
 * }
 * ```
 */
export function useAudioInput(): UseAudioInputReturn {
  const isSupported = getSpeechRecognitionCtor() !== null;
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  /** Set to true when the user explicitly stops (or unmounts); prevents iOS auto-restart */
  const stoppedRef = useRef(false);
  /** Accumulates all finalized speech segments across iOS restarts */
  const finalTextRef = useRef('');
  const callbackRef = useRef<{ baseText: string; onTranscript: (t: string) => void } | null>(null);
  /**
   * Holds the latest startSession function so onend can call it for iOS
   * auto-restart without creating a stale closure.
   */
  const startSessionRef = useRef<(() => void) | null>(null);

  const startSession = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || stoppedRef.current) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          finalTextRef.current = joinWithSpace(finalTextRef.current, r[0].transcript);
        } else {
          interim = joinWithSpace(interim, r[0].transcript);
        }
      }
      const cb = callbackRef.current;
      if (cb) {
        const transcript = [cb.baseText, finalTextRef.current, interim]
          .filter(Boolean)
          .reduce(joinWithSpace, '');
        cb.onTranscript(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'aborted' fires when we call .stop() or .abort() — not a user-facing error
      if (event.error !== 'aborted') {
        setError(`Speech recognition error: ${event.error}`);
        setIsRecording(false);
        stoppedRef.current = true;
      }
    };

    recognition.onend = () => {
      if (!stoppedRef.current) {
        // iOS Safari ignores continuous: true and fires onend after each pause.
        // Restart automatically to simulate continuous recording.
        startSessionRef.current?.();
      } else {
        setIsRecording(false);
        recognitionRef.current = null;
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setError(`Failed to start speech recognition: ${String(e)}`);
      setIsRecording(false);
      stoppedRef.current = true;
    }
  }, []);

  // Keep the ref current so the onend handler always calls the latest version
  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  const start = useCallback(
    (baseText: string, onTranscript: (t: string) => void) => {
      if (!getSpeechRecognitionCtor()) return;
      // Abort any already-running session before starting a new one
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      setError(null);
      stoppedRef.current = false;
      finalTextRef.current = '';
      callbackRef.current = { baseText, onTranscript };
      setIsRecording(true);
      startSession();
    },
    [startSession],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  // Abort any active session on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  return { isSupported, isRecording, error, start, stop };
}
