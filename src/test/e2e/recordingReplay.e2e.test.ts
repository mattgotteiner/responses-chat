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

  describe('single-turn-web-search.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-web-search.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with web search tool', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5');
      expect(recording.request.data.input).toBe('Use the web search tool only to provide a summary of paris');
      expect(recording.request.data.reasoning).toEqual({
        effort: 'low',
        summary: 'detailed',
      });
      // Verify web search tool is configured
      expect(recording.request.data.tools).toBeDefined();
      expect(recording.request.data.tools).toContainEqual({ type: 'web_search_preview' });
    });

    it('contains web search call events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have web search call events
      expect(stats.eventTypes['response.web_search_call.in_progress']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.web_search_call.searching']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.web_search_call.completed']).toBeGreaterThan(0);
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
      
      // Content should contain information about Paris
      expect(result.content).toContain('Paris');
      expect(result.content).toContain('France');
    });

    it('replays to produce reasoning steps', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated reasoning steps
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThanOrEqual(1);
      
      // Reasoning should contain content about searching for Paris
      const allReasoningText = result.reasoning.map((r) => r.content).join(' ');
      expect(allReasoningText).toContain('Paris');
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

    it('captures web search tool calls in response output', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain web_search_call items in output
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      const webSearchCalls = output.filter(
        (item): item is { type: string; status?: string } =>
          typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'web_search_call'
      );
      expect(webSearchCalls.length).toBeGreaterThan(0);
      
      // Verify web search calls have completed status
      webSearchCalls.forEach((call) => {
        expect(call.status).toBe('completed');
      });
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

  describe('single-turn-code-interpreter.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-code-interpreter.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with code interpreter tool', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5');
      expect(recording.request.data.input).toBe('Write and run a fizz buzz from 1 - 15');
      expect(recording.request.data.reasoning).toEqual({
        effort: 'low',
        summary: 'detailed',
      });
      // Verify code interpreter tool is configured
      expect(recording.request.data.tools).toBeDefined();
      expect(recording.request.data.tools).toContainEqual({ 
        type: 'code_interpreter', 
        container: { type: 'auto' } 
      });
      // Verify include parameter for getting outputs
      expect(recording.request.data.include).toContainEqual('code_interpreter_call.outputs');
    });

    it('contains code interpreter call events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have code interpreter call events
      expect(stats.eventTypes['response.code_interpreter_call.in_progress']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.code_interpreter_call.interpreting']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.code_interpreter_call.completed']).toBeGreaterThan(0);
    });

    it('contains code interpreter code delta events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have code delta events for streaming code
      expect(stats.eventTypes['response.code_interpreter_call_code.delta']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.code_interpreter_call_code.done']).toBe(1);
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
      
      // Content should contain the message about running FizzBuzz from 1 to 15
      expect(result.content).toContain('Fizz');
      expect(result.content).toContain('Buzz');
      expect(result.content).toContain('15');
    });

    it('replays to produce reasoning steps', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated reasoning steps
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThanOrEqual(1);
      
      // Reasoning should contain content about FizzBuzz implementation
      const allReasoningText = result.reasoning.map((r) => r.content).join(' ');
      expect(allReasoningText).toContain('FizzBuzz');
    });

    it('replays to capture code interpreter tool calls', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated code interpreter tool calls
      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls.length).toBeGreaterThan(0);
      
      // Find the code interpreter call
      const codeInterpreterCall = result.toolCalls.find(
        (t) => t.type === 'code_interpreter'
      );
      expect(codeInterpreterCall).toBeDefined();
      expect(codeInterpreterCall?.name).toBe('code_interpreter');
      expect(codeInterpreterCall?.status).toBe('completed');
    });

    it('captures streamed code from delta events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Find the code interpreter call
      const codeInterpreterCall = result.toolCalls.find(
        (t) => t.type === 'code_interpreter'
      );
      expect(codeInterpreterCall).toBeDefined();
      
      // Code should contain the FizzBuzz implementation for 1-15
      expect(codeInterpreterCall?.code).toContain('FizzBuzz');
      expect(codeInterpreterCall?.code).toContain('for');
      expect(codeInterpreterCall?.code).toContain('Fizz');
      expect(codeInterpreterCall?.code).toContain('Buzz');
      expect(codeInterpreterCall?.code).toContain('range(1, 16)');
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

    it('captures code interpreter calls in response output', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain code_interpreter_call items in output
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      const codeInterpreterCalls = output.filter(
        (item): item is { type: string; status?: string; code?: string } =>
          typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'code_interpreter_call'
      );
      expect(codeInterpreterCalls.length).toBeGreaterThan(0);
      
      // Verify code interpreter calls have completed status
      codeInterpreterCalls.forEach((call) => {
        expect(call.status).toBe('completed');
      });
    });

    it('produces consistent results on multiple replays', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      const result1 = replayRecording(recording);
      const result2 = replayRecording(recording);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.responseId).toBe(result2.responseId);
      expect(result1.toolCalls.length).toBe(result2.toolCalls.length);
      expect(result1.reasoning.length).toBe(result2.reasoning.length);
      
      // Compare code interpreter tool calls
      const ci1 = result1.toolCalls.find((t) => t.type === 'code_interpreter');
      const ci2 = result2.toolCalls.find((t) => t.type === 'code_interpreter');
      expect(ci1?.code).toBe(ci2?.code);
    });

    it('has reasonable recording duration', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording should be between 1 second and 60 seconds
      expect(stats.durationMs).toBeGreaterThan(1000);
      expect(stats.durationMs).toBeLessThan(60000);
    });

    // The API returns outputs when the include parameter has 'code_interpreter_call.outputs'
    it('captures code interpreter execution output with include parameter', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      const codeInterpreterCall = result.toolCalls.find(
        (t) => t.type === 'code_interpreter'
      );
      
      // The recording has outputs from the API (thanks to include parameter)
      expect(codeInterpreterCall?.output).toBeDefined();
      // Should contain FizzBuzz output for 1-15
      expect(codeInterpreterCall?.output).toContain('1');
      expect(codeInterpreterCall?.output).toContain('2');
      expect(codeInterpreterCall?.output).toContain('Fizz');
      expect(codeInterpreterCall?.output).toContain('Buzz');
      expect(codeInterpreterCall?.output).toContain('FizzBuzz');
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
