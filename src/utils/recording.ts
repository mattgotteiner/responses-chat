/**
 * Recording utilities for capturing API responses for e2e testing
 * 
 * When VITE_RECORD_MODE=true, all streaming events from the OpenAI SDK
 * are serialized as plain text (JSON Lines) and downloaded via the browser.
 */

/** Check if record mode is enabled via environment variable */
export function isRecordModeEnabled(): boolean {
  return import.meta.env.VITE_RECORD_MODE === 'true';
}

/** Generate a UUID v4 for recording filenames */
export function generateRecordingId(): string {
  return crypto.randomUUID();
}

/** Recording event to capture */
export interface RecordingEvent {
  /** Event type from the SDK */
  type: string;
  /** Timestamp of the event */
  timestamp: number;
  /** Event data */
  data: unknown;
}

/** Request payload recorded at the start of a session */
export interface RecordingRequest {
  /** Marker type for the request line */
  type: 'request';
  /** Timestamp of the request */
  timestamp: number;
  /** Request payload sent to the API */
  data: Record<string, unknown>;
}

/** Parsed recording file contents */
export interface Recording {
  /** The request payload from the first line */
  request: RecordingRequest;
  /** All streaming events */
  events: RecordingEvent[];
}

/** Recording session that captures all events for a single conversation turn */
export class RecordingSession {
  private readonly id: string;
  private readonly events: RecordingEvent[] = [];
  private readonly startTime: number;
  private request: RecordingRequest | null = null;

  constructor() {
    this.id = generateRecordingId();
    this.startTime = Date.now();
  }

  /** Record the request payload (should be called first) */
  recordRequest(payload: Record<string, unknown>): void {
    this.request = {
      type: 'request',
      timestamp: 0,
      data: payload,
    };
  }

  /** Get the recording session ID */
  getId(): string {
    return this.id;
  }

  /** Record a streaming event */
  recordEvent(event: { type: string; [key: string]: unknown }): void {
    this.events.push({
      type: event.type,
      timestamp: Date.now() - this.startTime,
      data: event,
    });
  }

  /** Finalize and download the recording as a text file */
  finalize(): void {
    const lines: string[] = [];
    
    // First line is the request payload
    if (this.request) {
      lines.push(JSON.stringify(this.request));
    }
    
    // Remaining lines are the events
    for (const event of this.events) {
      lines.push(JSON.stringify(event));
    }
    
    const content = lines.join('\n');

    // Create and trigger download of the recording file
    const blob = new Blob([content], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${this.id}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`[RECORD] Saved recording: recording-${this.id}.jsonl (${this.events.length} events)`);
  }
}

/** Create a new recording session if record mode is enabled */
export function createRecordingSession(): RecordingSession | null {
  if (!isRecordModeEnabled()) {
    return null;
  }
  console.log('[RECORD] Recording mode enabled, starting new session');
  return new RecordingSession();
}

/**
 * Parse a recording file content (JSON Lines format) into a Recording object
 * 
 * @param content - The raw text content of a .jsonl recording file
 * @returns Parsed recording with request and events
 * @throws Error if the content is invalid or missing required fields
 */
export function loadRecording(content: string): Recording {
  const lines = content.trim().split('\n').filter((line) => line.length > 0);
  
  if (lines.length === 0) {
    throw new Error('Recording file is empty');
  }
  
  const firstLine = JSON.parse(lines[0]) as { type: string; timestamp: number; data: unknown };
  
  if (firstLine.type !== 'request') {
    throw new Error('Recording file must start with a request line');
  }
  
  const request: RecordingRequest = {
    type: 'request',
    timestamp: firstLine.timestamp,
    data: firstLine.data as Record<string, unknown>,
  };
  
  const events: RecordingEvent[] = lines.slice(1).map((line) => {
    const parsed = JSON.parse(line) as RecordingEvent;
    return {
      type: parsed.type,
      timestamp: parsed.timestamp,
      data: parsed.data,
    };
  });
  
  return { request, events };
}
