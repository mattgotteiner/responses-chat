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

  describe('single-turn-mcp.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-mcp.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with MCP tool', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5');
      expect(recording.request.data.input).toBe('search ms learn MCP for foundry documentation');
      expect(recording.request.data.reasoning).toEqual({
        effort: 'low',
        summary: 'detailed',
      });
      // Verify MCP tool is configured
      expect(recording.request.data.tools).toBeDefined();
      const tools = recording.request.data.tools as Array<{
        type: string;
        server_label?: string;
        server_url?: string;
        require_approval?: string;
      }>;
      const mcpTool = tools.find((t) => t.type === 'mcp');
      expect(mcpTool).toBeDefined();
      expect(mcpTool?.server_label).toBe('mslearn');
      expect(mcpTool?.server_url).toBe('https://learn.microsoft.com/api/mcp');
      expect(mcpTool?.require_approval).toBe('never');
    });

    it('contains MCP list tools events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have MCP list tools events
      expect(stats.eventTypes['response.mcp_list_tools.in_progress']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.mcp_list_tools.completed']).toBeGreaterThan(0);
    });

    it('contains MCP call events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have MCP call events
      expect(stats.eventTypes['response.mcp_call.in_progress']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.mcp_call.completed']).toBeGreaterThan(0);
    });

    it('contains MCP call arguments delta events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have MCP call arguments streaming events
      expect(stats.eventTypes['response.mcp_call_arguments.delta']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.mcp_call_arguments.done']).toBeGreaterThan(0);
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
      
      // Content should contain information about Azure documentation
      expect(result.content).toContain('Azure');
      expect(result.content).toContain('Microsoft Learn');
    });

    it('replays to produce reasoning steps', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated reasoning steps
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThanOrEqual(1);
      
      // Reasoning should contain content about searching for Azure
      const allReasoningText = result.reasoning.map((r) => r.content).join(' ');
      expect(allReasoningText).toContain('Azure');
    });

    it('replays to capture MCP tool calls', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated MCP tool calls
      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls.length).toBeGreaterThan(0);
      
      // Find the MCP calls
      const mcpCalls = result.toolCalls.filter((t) => t.type === 'mcp');
      expect(mcpCalls.length).toBeGreaterThan(0);
      
      // Verify MCP calls have expected properties
      mcpCalls.forEach((call) => {
        expect(call.name).toContain('microsoft_docs_search');
        expect(call.status).toBe('completed');
      });
    });

    it('captures streamed MCP arguments from delta events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Find an MCP call
      const mcpCall = result.toolCalls.find((t) => t.type === 'mcp');
      expect(mcpCall).toBeDefined();
      
      // Arguments should contain the query
      expect(mcpCall?.arguments).toContain('query');
      expect(mcpCall?.arguments).toContain('Azure');
    });

    it('captures MCP call results', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Find an MCP call with results
      const mcpCall = result.toolCalls.find(
        (t) => t.type === 'mcp' && t.result
      );
      expect(mcpCall).toBeDefined();
      
      // Result should contain search results (the API returns JSON with results array)
      expect(mcpCall?.result).toContain('results');
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

    it('captures MCP calls in response output', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain mcp_call items in output
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      const mcpCalls = output.filter(
        (item): item is { type: string; status?: string; name?: string } =>
          typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'mcp_call'
      );
      expect(mcpCalls.length).toBeGreaterThan(0);
      
      // Verify MCP calls have completed status
      mcpCalls.forEach((call) => {
        expect(call.status).toBe('completed');
      });
    });

    it('captures mcp_list_tools in response output', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain mcp_list_tools item in output
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      const mcpListTools = output.filter(
        (item): item is { type: string; server_label?: string; tools?: unknown[] } =>
          typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'mcp_list_tools'
      );
      expect(mcpListTools.length).toBeGreaterThan(0);
      
      // Verify the tools were listed for the mslearn server
      const mslearnList = mcpListTools.find((m) => m.server_label === 'mslearn');
      expect(mslearnList).toBeDefined();
      expect(mslearnList?.tools).toBeDefined();
      expect(Array.isArray(mslearnList?.tools)).toBe(true);
    });

    it('produces consistent results on multiple replays', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      const result1 = replayRecording(recording);
      const result2 = replayRecording(recording);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.responseId).toBe(result2.responseId);
      expect(result1.toolCalls.length).toBe(result2.toolCalls.length);
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

  describe('multi-turn-mcp-approval.jsonl', () => {
    const FIXTURE_NAME = 'multi-turn-mcp-approval.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with MCP approval response', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5.2');
      // This is a continuation request with approval response
      expect(recording.request.data.previous_response_id).toBeDefined();
      expect(recording.request.data.previous_response_id).toMatch(/^resp_/);
      
      // Verify MCP tool with require_approval: always
      const tools = recording.request.data.tools as Array<{
        type: string;
        server_label?: string;
        require_approval?: string;
      }>;
      const mcpTool = tools.find((t) => t.type === 'mcp');
      expect(mcpTool).toBeDefined();
      expect(mcpTool?.require_approval).toBe('always');
      
      // Verify input contains mcp_approval_response with approve: true
      const input = recording.request.data.input as Array<{
        type: string;
        approval_request_id?: string;
        approve?: boolean;
      }>;
      const approvalResponse = input.find((i) => i.type === 'mcp_approval_response');
      expect(approvalResponse).toBeDefined();
      expect(approvalResponse?.approve).toBe(true);
      expect(approvalResponse?.approval_request_id).toMatch(/^mcpr_/);
    });

    it('contains MCP call events after approval', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // After approval, we should see MCP call events
      expect(stats.eventTypes['response.mcp_call.in_progress']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.mcp_call.completed']).toBeGreaterThan(0);
    });

    it('replays to produce accumulated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('replays to capture MCP tool calls with approval_request_id', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated MCP tool calls
      expect(result.toolCalls).toBeDefined();
      
      // Find the MCP calls
      const mcpCalls = result.toolCalls.filter((t) => t.type === 'mcp');
      expect(mcpCalls.length).toBeGreaterThan(0);
      
      // Verify MCP calls have completed status after approval
      mcpCalls.forEach((call) => {
        expect(call.status).toBe('completed');
      });
    });

    it('captures response.completed events for multi-turn approval flow', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording contains 2 API calls: initial request paused for approval, then approval response
      expect(stats.eventTypes['response.completed']).toBe(2);
    });

    it('extracts response ID for conversation continuity', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      expect(result.responseId).toBeDefined();
      expect(result.responseId).toMatch(/^resp_/);
    });
  });

  describe('multi-turn-mcp-denied.jsonl', () => {
    const FIXTURE_NAME = 'multi-turn-mcp-denied.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with MCP denial response', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5.2');
      // This is a continuation request with denial response
      expect(recording.request.data.previous_response_id).toBeDefined();
      expect(recording.request.data.previous_response_id).toMatch(/^resp_/);
      
      // Verify MCP tool with require_approval: always
      const tools = recording.request.data.tools as Array<{
        type: string;
        server_label?: string;
        require_approval?: string;
      }>;
      const mcpTool = tools.find((t) => t.type === 'mcp');
      expect(mcpTool).toBeDefined();
      expect(mcpTool?.require_approval).toBe('always');
      
      // Verify input contains mcp_approval_response with approve: false
      const input = recording.request.data.input as Array<{
        type: string;
        approval_request_id?: string;
        approve?: boolean;
      }>;
      const approvalResponse = input.find((i) => i.type === 'mcp_approval_response');
      expect(approvalResponse).toBeDefined();
      expect(approvalResponse?.approve).toBe(false);
      expect(approvalResponse?.approval_request_id).toMatch(/^mcpr_/);
    });

    it('does not contain MCP call completed events after denial', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // After denial, we should NOT see MCP call completed events
      expect(stats.eventTypes['response.mcp_call.completed']).toBeUndefined();
    });

    it('replays to produce content explaining denial', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content (model explains it cannot proceed)
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('captures response.completed events for multi-turn denial flow', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording contains 2 API calls: initial request paused for approval, then denial response
      expect(stats.eventTypes['response.completed']).toBe(2);
    });

    it('extracts response ID for conversation continuity', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      expect(result.responseId).toBeDefined();
      expect(result.responseId).toMatch(/^resp_/);
    });
  });

  describe('multi-turn-mcp-approve-deny.jsonl', () => {
    const FIXTURE_NAME = 'multi-turn-mcp-approve-deny.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with MCP denial response', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5');
      // This is a continuation request
      expect(recording.request.data.previous_response_id).toBeDefined();
      expect(recording.request.data.previous_response_id).toMatch(/^resp_/);
      
      // Verify MCP tool with require_approval: always
      const tools = recording.request.data.tools as Array<{
        type: string;
        server_label?: string;
        require_approval?: string;
      }>;
      const mcpTool = tools.find((t) => t.type === 'mcp');
      expect(mcpTool).toBeDefined();
      expect(mcpTool?.require_approval).toBe('always');
      
      // This recording shows denial of a second tool call (first was approved)
      const input = recording.request.data.input as Array<{
        type: string;
        approval_request_id?: string;
        approve?: boolean;
      }>;
      const approvalResponse = input.find((i) => i.type === 'mcp_approval_response');
      expect(approvalResponse).toBeDefined();
      expect(approvalResponse?.approve).toBe(false);
    });

    it('contains MCP approval request events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Should have mcp_approval_request output item events
      expect(
        (stats.eventTypes['response.output_item.added'] || 0) +
        (stats.eventTypes['response.output_item.done'] || 0)
      ).toBeGreaterThan(0);
    });

    it('replays to produce accumulated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it('captures response.completed events for multi-turn approve-deny flow', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording contains 3 API calls: initial, approval, then denial of second tool
      expect(stats.eventTypes['response.completed']).toBe(3);
    });

    it('extracts response ID for conversation continuity', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      expect(result.responseId).toBeDefined();
      expect(result.responseId).toMatch(/^resp_/);
    });

    it('has reasoning enabled', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.data.reasoning).toEqual({
        effort: 'low',
        summary: 'detailed',
      });
    });

    it('produces consistent results on multiple replays', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      const result1 = replayRecording(recording);
      const result2 = replayRecording(recording);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.responseId).toBe(result2.responseId);
    });
  });

  describe('single-turn-pdf-upload.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-pdf-upload.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with file input', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBeDefined();
      
      // Verify input contains file attachment (PDF)
      const input = recording.request.data.input;
      expect(Array.isArray(input)).toBe(true);
      
      // Should have a message item with file content
      const inputArray = input as Array<{
        type?: string;
        role?: string;
        content?: Array<{ type: string; filename?: string; file_data?: string }>;
      }>;
      const messageWithFile = inputArray.find(
        (i) => i.role === 'user' && 
        Array.isArray(i.content) && 
        i.content.some((c) => c.type === 'input_file')
      );
      expect(messageWithFile).toBeDefined();
      
      // Verify file content exists with filename and file_data directly on the content item
      const fileContent = messageWithFile?.content?.find((c) => c.type === 'input_file');
      expect(fileContent).toBeDefined();
      expect(fileContent?.filename).toBe('Benefit_Options.pdf');
      expect(fileContent?.file_data).toContain('data:application/pdf;base64,');
    });

    it('contains expected event types', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have response lifecycle events
      expect(stats.eventTypes['response.created']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.completed']).toBe(1);
      
      // Should have output text deltas for the response content
      expect(stats.eventTypes['response.output_text.delta']).toBeGreaterThan(0);
    });

    it('replays to produce accumulated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
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
    });

    it('has reasonable recording duration', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording should be between 1 second and 2 minutes (PDF processing may take longer)
      expect(stats.durationMs).toBeGreaterThan(1000);
      expect(stats.durationMs).toBeLessThan(120000);
    });
  });

  describe('single-turn-image-upload.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-image-upload.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with image input', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBeDefined();
      
      // Verify input contains image attachment
      const input = recording.request.data.input;
      expect(Array.isArray(input)).toBe(true);
      
      // Should have a message item with image content
      const inputArray = input as Array<{
        type?: string;
        role?: string;
        content?: Array<{ type: string; image_url?: string }>;
      }>;
      const messageWithImage = inputArray.find(
        (i) => i.role === 'user' && 
        Array.isArray(i.content) && 
        i.content.some((c) => c.type === 'input_image')
      );
      expect(messageWithImage).toBeDefined();
      
      // Verify image content exists with base64 data URL (image_url is a string in Responses API)
      const imageContent = messageWithImage?.content?.find((c) => c.type === 'input_image');
      expect(imageContent).toBeDefined();
      expect(imageContent?.image_url).toContain('data:image/');
    });

    it('contains expected event types', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have response lifecycle events
      expect(stats.eventTypes['response.created']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.completed']).toBe(1);
      
      // Should have output text deltas for the response content
      expect(stats.eventTypes['response.output_text.delta']).toBeGreaterThan(0);
    });

    it('replays to produce accumulated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
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
    });

    it('has reasonable recording duration', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording should be between 1 second and 2 minutes (image processing may take longer)
      expect(stats.durationMs).toBeGreaterThan(1000);
      expect(stats.durationMs).toBeLessThan(120000);
    });
  });

  describe('single-turn-web-open-page.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-web-open-page.jsonl';

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
      expect(recording.request.data.input).toContain('Paris');
      expect(recording.request.data.input).toContain('opening the page');
      expect(recording.request.data.reasoning).toEqual({
        effort: 'medium',
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

    it('contains URL citation annotation events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have annotation events from opening pages
      expect(stats.eventTypes['response.output_text.annotation.added']).toBeGreaterThan(0);
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

    it('captures URL citations in message annotations', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain message items with annotations
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      // Find message items with content that has annotations
      const messageItems = output.filter(
        (item): item is { type: string; content?: Array<{ annotations?: unknown[] }> } =>
          typeof item === 'object' && 
          item !== null && 
          (item as { type?: unknown }).type === 'message'
      );
      expect(messageItems.length).toBeGreaterThan(0);
      
      // Find annotations in the message content
      const annotations = messageItems.flatMap((msg) => 
        (msg.content || []).flatMap((c) => (c.annotations || []))
      );
      expect(annotations.length).toBeGreaterThan(0);
      
      // Verify annotations are URL citations for Wikipedia
      const urlCitations = annotations.filter(
        (a): a is { type: string; url?: string; title?: string } =>
          typeof a === 'object' && a !== null && (a as { type?: unknown }).type === 'url_citation'
      );
      expect(urlCitations.length).toBeGreaterThan(0);
      
      // Should have Wikipedia citations about Paris
      const wikipediaCitations = urlCitations.filter((c) => 
        c.url?.includes('wikipedia.org') && c.url?.toLowerCase().includes('paris')
      );
      expect(wikipediaCitations.length).toBeGreaterThan(0);
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

  describe('single-turn-file-search.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-file-search.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with file search tool', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5-mini');
      expect(recording.request.data.input).toBe("What's my hello world document say?");
      // Verify file search tool is configured
      expect(recording.request.data.tools).toBeDefined();
      const tools = recording.request.data.tools as Array<{
        type: string;
        vector_store_ids?: string[];
      }>;
      const fileSearchTool = tools.find((t) => t.type === 'file_search');
      expect(fileSearchTool).toBeDefined();
      expect(fileSearchTool?.vector_store_ids).toBeDefined();
      expect(fileSearchTool?.vector_store_ids?.length).toBeGreaterThan(0);
    });

    it('contains file search call events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have file search call events
      expect(stats.eventTypes['response.file_search_call.in_progress']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.file_search_call.searching']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.file_search_call.completed']).toBeGreaterThan(0);
    });

    it('contains file citation annotation events', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have annotation events from file citations
      expect(stats.eventTypes['response.output_text.annotation.added']).toBeGreaterThan(0);
    });

    it('contains expected event types', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have response lifecycle events
      expect(stats.eventTypes['response.created']).toBeGreaterThan(0);
      expect(stats.eventTypes['response.completed']).toBe(1);
      
      // Should have output text deltas for the response content
      expect(stats.eventTypes['response.output_text.delta']).toBeGreaterThan(0);
    });

    it('replays to produce accumulated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      
      // Content should contain information about the hello world file
      expect(result.content).toContain('Hello world');
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

    it('captures file search tool calls in response output', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain file_search_call items in output
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      const fileSearchCalls = output.filter(
        (item): item is { type: string; status?: string; queries?: string[] } =>
          typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'file_search_call'
      );
      expect(fileSearchCalls.length).toBeGreaterThan(0);
      
      // Verify file search calls have completed status
      fileSearchCalls.forEach((call) => {
        expect(call.status).toBe('completed');
      });
      
      // Verify queries were generated for "hello world"
      const allQueries = fileSearchCalls.flatMap((call) => call.queries || []);
      const hasHelloWorldQuery = allQueries.some((q) => 
        q.toLowerCase().includes('hello') && q.toLowerCase().includes('world')
      );
      expect(hasHelloWorldQuery).toBe(true);
    });

    it('captures file citation annotations in message', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // The response should contain message items with file citation annotations
      expect(result.responseJson).toBeDefined();
      const output = result.responseJson?.output;
      if (!Array.isArray(output)) {
        throw new Error('Expected responseJson.output to be an array');
      }
      
      // Find message items with content that has annotations
      const messageItems = output.filter(
        (item): item is { type: string; content?: Array<{ annotations?: unknown[] }> } =>
          typeof item === 'object' && 
          item !== null && 
          (item as { type?: unknown }).type === 'message'
      );
      expect(messageItems.length).toBeGreaterThan(0);
      
      // Find annotations in the message content
      const annotations = messageItems.flatMap((msg) => 
        (msg.content || []).flatMap((c) => (c.annotations || []))
      );
      expect(annotations.length).toBeGreaterThan(0);
      
      // Verify annotations are file citations
      const fileCitations = annotations.filter(
        (a): a is { type: string; file_id?: string; filename?: string } =>
          typeof a === 'object' && a !== null && (a as { type?: unknown }).type === 'file_citation'
      );
      expect(fileCitations.length).toBeGreaterThan(0);
      
      // Should cite "Hello world!.txt"
      const helloWorldCitation = fileCitations.find((c) => 
        c.filename?.includes('Hello world')
      );
      expect(helloWorldCitation).toBeDefined();
    });

    it('produces consistent results on multiple replays', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      const result1 = replayRecording(recording);
      const result2 = replayRecording(recording);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.responseId).toBe(result2.responseId);
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

  describe('single-turn-token-truncation.jsonl', () => {
    const FIXTURE_NAME = 'single-turn-token-truncation.jsonl';

    it('loads the recording fixture successfully', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording).toBeDefined();
      expect(recording.request).toBeDefined();
      expect(recording.events).toBeDefined();
      expect(Array.isArray(recording.events)).toBe(true);
    });

    it('has correct request metadata with max_output_tokens', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      expect(recording.request.type).toBe('request');
      expect(recording.request.data.model).toBe('gpt-5');
      expect(recording.request.data.input).toBe('war and peace mega summary');
      expect(recording.request.data.max_output_tokens).toBe(1000);
      expect(recording.request.data.reasoning).toEqual({
        effort: 'low',
        summary: 'detailed',
      });
    });

    it('contains expected event types including response.incomplete', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // This recording should have response lifecycle events
      expect(stats.eventTypes['response.created']).toBeGreaterThan(0);
      
      // Should have response.incomplete instead of response.completed (truncated)
      expect(stats.eventTypes['response.incomplete']).toBe(1);
      expect(stats.eventTypes['response.completed']).toBeUndefined();
      
      // Should have output text deltas for the response content
      expect(stats.eventTypes['response.output_text.delta']).toBeGreaterThan(0);
    });

    it('replays to produce truncated content', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have accumulated text content from the response
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      
      // Content should contain text about War and Peace
      expect(result.content).toContain('War and Peace');
      expect(result.content).toContain('Tolstoy');
    });

    it('detects truncation from incomplete_details', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should indicate truncation occurred
      expect(result.isTruncated).toBe(true);
      expect(result.truncationReason).toBe('max_output_tokens');
    });

    it('captures incomplete status in response JSON', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have the full response object with incomplete status
      expect(result.responseJson).toBeDefined();
      expect(result.responseJson).not.toBeNull();
      expect(result.responseJson!.status).toBe('incomplete');
      expect(result.responseJson!.incomplete_details).toEqual({ reason: 'max_output_tokens' });
    });

    it('extracts response ID even for truncated responses', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const result = replayRecording(recording);
      
      // Should have captured the response ID from response.incomplete
      expect(result.responseId).toBeDefined();
      expect(result.responseId).not.toBeNull();
      expect(result.responseId).toMatch(/^resp_/);
    });

    it('produces consistent results on multiple replays', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      
      const result1 = replayRecording(recording);
      const result2 = replayRecording(recording);
      
      expect(result1.content).toBe(result2.content);
      expect(result1.responseId).toBe(result2.responseId);
      expect(result1.isTruncated).toBe(result2.isTruncated);
      expect(result1.truncationReason).toBe(result2.truncationReason);
    });

    it('has reasonable recording duration', () => {
      const recording = loadRecordingFixture(FIXTURE_NAME);
      const stats = getRecordingStats(recording);
      
      // Recording should be between 1 second and 60 seconds
      expect(stats.durationMs).toBeGreaterThan(1000);
      expect(stats.durationMs).toBeLessThan(60000);
    });
  });
});
