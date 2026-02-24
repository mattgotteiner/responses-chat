import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioInput } from './useAudioInput';

type MockRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

describe('useAudioInput', () => {
  let mockInstance: MockRecognitionInstance;
  let MockRecognition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockInstance = {
      continuous: false,
      interimResults: false,
      lang: '',
      onresult: null,
      onerror: null,
      onend: null,
      start: vi.fn(),
      stop: vi.fn(),
      abort: vi.fn(),
    };
    // Must be a regular function (not arrow) so it can be called with `new`
    MockRecognition = vi.fn(function MockSpeechRecognition() {
      return mockInstance;
    });

    Object.defineProperty(window, 'SpeechRecognition', {
      value: MockRecognition,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it('reports supported when SpeechRecognition is available', () => {
    const { result } = renderHook(() => useAudioInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('reports unsupported when neither SpeechRecognition API is available', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useAudioInput());
    expect(result.current.isSupported).toBe(false);
  });

  it('reports supported via webkitSpeechRecognition', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: vi.fn(function MockSpeechRecognition() {
        return mockInstance;
      }),
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useAudioInput());
    expect(result.current.isSupported).toBe(true);
  });

  it('starts with isRecording false', () => {
    const { result } = renderHook(() => useAudioInput());
    expect(result.current.isRecording).toBe(false);
  });

  it('starts with error null', () => {
    const { result } = renderHook(() => useAudioInput());
    expect(result.current.error).toBeNull();
  });

  it('sets isRecording to true and calls recognition.start when start() is called', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockInstance.start).toHaveBeenCalledTimes(1);
  });

  it('configures recognition with continuous and interimResults', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });

    expect(mockInstance.continuous).toBe(true);
    expect(mockInstance.interimResults).toBe(true);
    expect(mockInstance.lang).toBe(navigator.language || 'en-US');
  });

  it('uses navigator.language for recognition lang', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'language');
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
    try {
      const { result } = renderHook(() => useAudioInput());
      act(() => { result.current.start('', vi.fn()); });
      expect(mockInstance.lang).toBe('fr-FR');
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'language', original);
      }
    }
  });

  it('sets isRecording to false and calls recognition.stop when stop() is called', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });
    act(() => {
      result.current.stop();
    });

    expect(result.current.isRecording).toBe(false);
    expect(mockInstance.stop).toHaveBeenCalledTimes(1);
  });

  it('calls onTranscript with final results', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', onTranscript);
    });
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: true, 0: { transcript: 'hello world' } },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('hello world');
  });

  it('prepends baseText before transcript with a space separator', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('prefix', onTranscript);
    });
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: true, 0: { transcript: 'hello' } },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('prefix hello');
  });

  it('does not add extra space when baseText ends with a space', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('prefix ', onTranscript);
    });
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: true, 0: { transcript: 'hello' } },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('prefix hello');
  });

  it('includes interim results in onTranscript', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', onTranscript);
    });
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: false, 0: { transcript: 'typing...' } },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('typing...');
  });

  it('accumulates multiple final results', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', onTranscript);
    });
    act(() => {
      // First event — final segment
      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: { isFinal: true, 0: { transcript: 'hello' } },
        },
      });
    });
    act(() => {
      // Second event — new final segment starting at index 1
      mockInstance.onresult?.({
        resultIndex: 1,
        results: {
          length: 2,
          0: { isFinal: true, 0: { transcript: 'hello' } },
          1: { isFinal: true, 0: { transcript: 'world' } },
        },
      });
    });

    expect(onTranscript).toHaveBeenLastCalledWith('hello world');
  });

  it('sets error state on speech recognition error', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });
    act(() => {
      mockInstance.onerror?.({ error: 'not-allowed' });
    });

    expect(result.current.error).toContain('not-allowed');
    expect(result.current.isRecording).toBe(false);
  });

  it('does not set error for aborted recognition', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });

    act(() => {
      mockInstance.onerror?.({ error: 'aborted' });
    });

    expect(result.current.error).toBeNull();
  });

  it('auto-restarts on onend when not explicitly stopped (iOS continuous mode)', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });

    // Simulate iOS firing onend without an explicit stop
    act(() => {
      mockInstance.onend?.();
    });

    // Should have created a second recognition instance and started it
    expect(MockRecognition).toHaveBeenCalledTimes(2);
    expect(result.current.isRecording).toBe(true);
  });

  it('does not restart on onend when explicitly stopped', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });
    act(() => {
      result.current.stop();
    });
    act(() => {
      mockInstance.onend?.();
    });

    expect(MockRecognition).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });

  it('aborts recognition on unmount', () => {
    const { result, unmount } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });

    unmount();

    expect(mockInstance.abort).toHaveBeenCalledTimes(1);
  });

  it('resets final text on new start call', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    // First recording session
    act(() => {
      result.current.start('', onTranscript);
    });
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: 'first' } } },
      });
    });
    act(() => {
      result.current.stop();
    });

    onTranscript.mockClear();

    // Second recording session — final text should reset
    act(() => {
      result.current.start('', onTranscript);
    });
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: 'second' } } },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('second');
  });

  it('baseText is captured once at start; subsequent recognition events do not re-read textarea value', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('initial', onTranscript);
    });

    // First recognition event — final segment
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: true, 0: { transcript: 'hello' } } },
      });
    });
    expect(onTranscript).toHaveBeenLastCalledWith('initial hello');

    // Second recognition event — should still use the original 'initial' base, not the updated textarea
    act(() => {
      mockInstance.onresult?.({
        resultIndex: 1,
        results: {
          length: 2,
          0: { isFinal: true, 0: { transcript: 'hello' } },
          1: { isFinal: true, 0: { transcript: 'world' } },
        },
      });
    });
    // 'initial hello world', NOT 'initial hello hello world'
    expect(onTranscript).toHaveBeenLastCalledWith('initial hello world');
  });

  it('aborts existing session when start() is called while already recording', () => {
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', vi.fn());
    });

    const firstInstance = mockInstance;
    expect(firstInstance.start).toHaveBeenCalledTimes(1);

    // Call start() again without stopping — should abort the previous session
    act(() => {
      result.current.start('', vi.fn());
    });

    expect(firstInstance.abort).toHaveBeenCalledTimes(1);
    expect(MockRecognition).toHaveBeenCalledTimes(2);
  });

  it('joins multiple interim segments with spaces', () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useAudioInput());

    act(() => {
      result.current.start('', onTranscript);
    });
    act(() => {
      // Single event containing two interim results — should be space-joined
      mockInstance.onresult?.({
        resultIndex: 0,
        results: {
          length: 2,
          0: { isFinal: false, 0: { transcript: 'hello' } },
          1: { isFinal: false, 0: { transcript: 'world' } },
        },
      });
    });

    expect(onTranscript).toHaveBeenCalledWith('hello world');
  });
});
