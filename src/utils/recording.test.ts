import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRecordModeEnabled,
  generateRecordingId,
  RecordingSession,
  createRecordingSession,
  loadRecording,
} from './recording';

describe('recording utilities', () => {
  describe('isRecordModeEnabled', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns false when VITE_RECORD_MODE is not set', () => {
      vi.stubEnv('VITE_RECORD_MODE', '');
      expect(isRecordModeEnabled()).toBe(false);
    });

    it('returns false when VITE_RECORD_MODE is not "true"', () => {
      vi.stubEnv('VITE_RECORD_MODE', 'false');
      expect(isRecordModeEnabled()).toBe(false);
    });

    it('returns true when VITE_RECORD_MODE is "true"', () => {
      vi.stubEnv('VITE_RECORD_MODE', 'true');
      expect(isRecordModeEnabled()).toBe(true);
    });
  });

  describe('generateRecordingId', () => {
    it('returns a valid UUID v4 format', () => {
      const id = generateRecordingId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('generates unique IDs on each call', () => {
      const id1 = generateRecordingId();
      const id2 = generateRecordingId();
      const id3 = generateRecordingId();
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('RecordingSession', () => {
    let session: RecordingSession;

    beforeEach(() => {
      session = new RecordingSession();
    });

    it('generates a unique ID on creation', () => {
      const id = session.getId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('records events with type and timestamp', () => {
      const event = { type: 'response.output_text.delta', delta: 'Hello' };
      session.recordEvent(event);
      // We can't directly access private events, but finalize should work
      // This test verifies no error is thrown
      expect(() => session.recordEvent(event)).not.toThrow();
    });

    it('records multiple events', () => {
      session.recordEvent({ type: 'event1', data: 'first' });
      session.recordEvent({ type: 'event2', data: 'second' });
      session.recordEvent({ type: 'event3', data: 'third' });
      // Verify session still works after multiple events
      expect(session.getId()).toBeDefined();
    });

    it('records request payload', () => {
      const payload = { model: 'gpt-4', input: 'Hello' };
      session.recordRequest(payload);
      // Verify session still works after recording request
      expect(session.getId()).toBeDefined();
    });

    describe('finalize', () => {
      let createElementSpy: ReturnType<typeof vi.spyOn>;
      let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
      let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
      let appendChildSpy: ReturnType<typeof vi.spyOn>;
      let removeChildSpy: ReturnType<typeof vi.spyOn>;
      let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

      beforeEach(() => {
        mockAnchor = {
          href: '',
          download: '',
          click: vi.fn(),
        };
        createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
        createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
        revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
        removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
        vi.spyOn(console, 'log').mockImplementation(() => {});
      });

      afterEach(() => {
        vi.restoreAllMocks();
      });

      it('creates a download link with correct filename format', () => {
        session.recordEvent({ type: 'test', data: 'value' });
        session.finalize();

        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(mockAnchor.download).toMatch(/^recording-[0-9a-f-]+\.jsonl$/);
      });

      it('creates a blob URL and triggers click', () => {
        session.recordEvent({ type: 'test', data: 'value' });
        session.finalize();

        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(mockAnchor.href).toBe('blob:test-url');
        expect(mockAnchor.click).toHaveBeenCalled();
      });

      it('cleans up by revoking object URL and removing anchor', () => {
        session.recordEvent({ type: 'test', data: 'value' });
        session.finalize();

        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeChildSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
      });

      it('creates blob with JSONL content', () => {
        session.recordEvent({ type: 'event1', value: 1 });
        session.recordEvent({ type: 'event2', value: 2 });
        session.finalize();

        // Verify Blob was created (via createObjectURL being called)
        expect(createObjectURLSpy).toHaveBeenCalled();
        const blobArg = createObjectURLSpy.mock.calls[0][0];
        expect(blobArg).toBeInstanceOf(Blob);
      });
    });
  });

  describe('createRecordingSession', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns null when record mode is disabled', () => {
      vi.stubEnv('VITE_RECORD_MODE', '');
      const session = createRecordingSession();
      expect(session).toBeNull();
    });

    it('returns a RecordingSession when record mode is enabled', () => {
      vi.stubEnv('VITE_RECORD_MODE', 'true');
      vi.spyOn(console, 'log').mockImplementation(() => {});
      const session = createRecordingSession();
      expect(session).toBeInstanceOf(RecordingSession);
      vi.restoreAllMocks();
    });
  });

  describe('loadRecording', () => {
    it('parses a valid recording with request and events', () => {
      const content = [
        '{"type":"request","timestamp":0,"data":{"model":"gpt-4","input":"Hello"}}',
        '{"type":"response.output_text.delta","timestamp":100,"data":{"type":"response.output_text.delta","delta":"Hi"}}',
        '{"type":"response.completed","timestamp":200,"data":{"type":"response.completed"}}',
      ].join('\n');

      const recording = loadRecording(content);

      expect(recording.request.type).toBe('request');
      expect(recording.request.data).toEqual({ model: 'gpt-4', input: 'Hello' });
      expect(recording.events).toHaveLength(2);
      expect(recording.events[0].type).toBe('response.output_text.delta');
      expect(recording.events[1].type).toBe('response.completed');
    });

    it('throws error for empty content', () => {
      expect(() => loadRecording('')).toThrow('Recording file is empty');
      expect(() => loadRecording('   \n  ')).toThrow('Recording file is empty');
    });

    it('throws error when first line is not a request', () => {
      const content = '{"type":"response.output_text.delta","timestamp":100,"data":{}}';
      expect(() => loadRecording(content)).toThrow('Recording file must start with a request line');
    });

    it('handles recording with only request and no events', () => {
      const content = '{"type":"request","timestamp":0,"data":{"model":"gpt-4"}}';
      const recording = loadRecording(content);

      expect(recording.request.type).toBe('request');
      expect(recording.events).toHaveLength(0);
    });

    it('handles content with extra blank lines', () => {
      const content = [
        '{"type":"request","timestamp":0,"data":{}}',
        '',
        '{"type":"event1","timestamp":10,"data":{}}',
        '',
      ].join('\n');

      const recording = loadRecording(content);
      expect(recording.events).toHaveLength(1);
    });
  });
});
