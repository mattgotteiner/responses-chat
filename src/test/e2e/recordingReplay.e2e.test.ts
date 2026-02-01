/**
 * E2E tests for recording replay functionality
 * 
 * These tests verify that our stream processing logic correctly handles
 * real API response recordings, ensuring the parser and accumulator work
 * with production-like event sequences.
 */

import { describe, it, expect } from 'vitest';
import { loadRecordingFixture } from '../helpers';
import { replayRecording, getRecordingStats } from '../../utils/recordingReplay';

describe('Recording Replay E2E', () => {
  describe('single-turn-reasoning.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-reasoning.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5');
      expect(recording.request.data.input).toBe('Write a fizzbuzz program in python');
      expect(recording.request.data.reasoning).toEqual({
        effort: 'low',
        summary: 'detailed',
      });
    });

    it('contains expected event types', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have response lifecycle events
      expect(stats.eventTypes['response.created']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.completed']).toBe(1);
      
      // Should have reasoning summary deltas (model was configured with reasoning)
      expect(stats.eventTypes['response.reasoning_summary_text.delta']).toBeGreaterThan(0);
      
      // Should have output text deltas for the response content
      expect(stats.eventTypes['response.output_text.delta']).toBeGreaterThan(0);
    });

    it('replays to produce accumulated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      
      // Content should contain the FizzBuzz Python code
      expect(result.content).toContain('def fizzbuzz');
      expect(result.content).toContain('FizzBuzz');
      expect(result.content).toContain('range(1, 101)');
    });

    it('replays to produce reasoning steps', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated reasoning steps
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThanOrEqual(2);
      
      // Reasoning should contain thoughtful content about FizzBuzz
      const allReasoningText = result.reasoning.map((r) => r.content).join(' ');
      expect(allReasoningText).toContain('FizzBuzz');
      expect(allReasoningText).toContain('Python');
    });

    it('extracts response ID for conversation continuity', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have captured the response ID from response.completed
      expect(result.responseId).toBeDefined();
      expect(result.responseId).not.toBeNull();
      expect(result.responseId).toMatch(/^resp_/);
    });

    it('captures full response JSON', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have the full response object
      expect(result.responseJson).toBeDefined();
      expect(result.responseJson).not.toBeNull();
      expect(result.responseJson!.id).toBe(result.responseId);
      expect(result.responseJson!.status).toBe('completed');
    });

    it('produces consistent results on multiple replays', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      const result1 = replayRecording(recording);
      const result2 = replayRecording(recording);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.responseId).toBe(result2.responseId);
      expect(result1.reasoning.length).toBe(result2.reasoning.length);
    });

    it('has reasonable recording duration', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording should be between 1 second and 60 seconds
      expect(stats.durationMs).toBeGreaterThan(1000);
      expect(stats.durationMs).toBeLessThan(60000);
    });
  });

  describe('Recording stats utility', () => {
    it('provides accurate event counts', () => {
      const recording = loadRecordingFixture('single-turn-reasoning.jsonl');
      const stats = getRecordingStats(recording);
      
      // Total events should match sum of individual event types
      const sumOfTypes = Object.values(stats.eventTypes).reduce((a, b) => a + b, 0);
      expect(stats.totalEvents).toBe(sumOfTypes);
    });

    it('extracts model from request', () => {
      const recording = loadRecordingFixture('single-turn-reasoning.jsonl');
      const stats = getRecordingStats(recording);
      
      expect(stats.requestModel).toBe('gpt-5');
    });
  });
});
