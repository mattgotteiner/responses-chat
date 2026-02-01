/**
 * Recording utilities for capturing API responses for e2e testing
 * 
 * When VITE_RECORD_MODE=true, all streaming events from the OpenAI SDK
 * are recorded to plain text files in the recordings/ directory.
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

/** Recording session that captures all events for a single conversation turn */
export class RecordingSession {
  private readonly id: string;
  private readonly events: RecordingEvent[] = [];
  private readonly startTime: number;

  constructor() {
    this.id = generateRecordingId();
    this.startTime = Date.now();
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
    const content = this.events
      .map((e) => JSON.stringify(e))
      .join('\n');

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
