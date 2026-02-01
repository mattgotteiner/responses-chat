/**
 * Recording replay utilities for e2e testing
 * 
 * Provides functions to replay recorded API sessions through
 * the stream processor for testing purposes.
 */

import type { Recording } from './recording';
import type { StreamEvent, StreamAccumulator } from './streamProcessor';
import { createInitialAccumulator, processStreamEvent } from './streamProcessor';

/**
 * Create an async generator that yields events from a recording
 * 
 * This can be used to mock the OpenAI SDK streaming response.
 * 
 * @param recording - Parsed recording containing events to replay
 * @param realtime - If true, delays between events match original timing
 * @returns Async generator yielding stream events
 */
export async function* createMockStream(
  recording: Recording,
  realtime = false
): AsyncGenerator<StreamEvent> {
  let previousTimestamp = 0;

  for (const recordedEvent of recording.events) {
    if (realtime && recordedEvent.timestamp > previousTimestamp) {
      const delay = recordedEvent.timestamp - previousTimestamp;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    previousTimestamp = recordedEvent.timestamp;

    // The event data from recording is the raw SDK event
    yield recordedEvent.data as StreamEvent;
  }
}

/**
 * Replay a recording and return the final accumulated state
 * 
 * Processes all events from the recording through the stream processor
 * and returns the final state, useful for e2e testing.
 * 
 * @param recording - Parsed recording to replay
 * @param initialAccumulator - Optional initial state
 * @returns Final accumulated state after all events
 */
export function replayRecording(
  recording: Recording,
  initialAccumulator?: StreamAccumulator
): StreamAccumulator {
  let accumulator = initialAccumulator ?? createInitialAccumulator();

  for (const recordedEvent of recording.events) {
    const event = recordedEvent.data as StreamEvent;
    accumulator = processStreamEvent(accumulator, event);
  }

  return accumulator;
}

/**
 * Get summary statistics about a recording
 * 
 * @param recording - Parsed recording to analyze
 * @returns Object containing event counts and timing info
 */
export function getRecordingStats(recording: Recording): {
  totalEvents: number;
  eventTypes: Record<string, number>;
  durationMs: number;
  requestModel: string | undefined;
} {
  const eventTypes: Record<string, number> = {};
  let maxTimestamp = 0;

  for (const event of recording.events) {
    eventTypes[event.type] = (eventTypes[event.type] || 0) + 1;
    if (event.timestamp > maxTimestamp) {
      maxTimestamp = event.timestamp;
    }
  }

  return {
    totalEvents: recording.events.length,
    eventTypes,
    durationMs: maxTimestamp,
    requestModel: recording.request.data.model as string | undefined,
  };
}
