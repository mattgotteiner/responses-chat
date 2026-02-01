import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_MODELS,
  MODEL_REASONING_EFFORTS,
  VERBOSITY_OPTIONS,
  REASONING_SUMMARY_OPTIONS,
  DEFAULT_SETTINGS,
} from './index';

describe('types constants', () => {
  describe('AVAILABLE_MODELS', () => {
    it('contains expected models', () => {
      expect(AVAILABLE_MODELS).toContain('gpt-5-mini');
      expect(AVAILABLE_MODELS).toContain('gpt-5');
      expect(AVAILABLE_MODELS.length).toBeGreaterThan(0);
    });
  });

  describe('MODEL_REASONING_EFFORTS', () => {
    it('has entries for all available models', () => {
      for (const model of AVAILABLE_MODELS) {
        expect(MODEL_REASONING_EFFORTS[model]).toBeDefined();
        expect(Array.isArray(MODEL_REASONING_EFFORTS[model])).toBe(true);
      }
    });

    it('all models support low, medium, high effort', () => {
      for (const model of AVAILABLE_MODELS) {
        expect(MODEL_REASONING_EFFORTS[model]).toContain('low');
        expect(MODEL_REASONING_EFFORTS[model]).toContain('medium');
        expect(MODEL_REASONING_EFFORTS[model]).toContain('high');
      }
    });
  });

  describe('VERBOSITY_OPTIONS', () => {
    it('contains low, medium, high', () => {
      expect(VERBOSITY_OPTIONS).toEqual(['low', 'medium', 'high']);
    });
  });

  describe('REASONING_SUMMARY_OPTIONS', () => {
    it('contains expected options', () => {
      expect(REASONING_SUMMARY_OPTIONS).toContain('auto');
      expect(REASONING_SUMMARY_OPTIONS).toContain('concise');
      expect(REASONING_SUMMARY_OPTIONS).toContain('detailed');
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('has required fields', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('endpoint');
      expect(DEFAULT_SETTINGS).toHaveProperty('apiKey');
      expect(DEFAULT_SETTINGS).toHaveProperty('modelName');
      expect(DEFAULT_SETTINGS).toHaveProperty('deploymentName');
    });

    it('has empty credentials by default', () => {
      expect(DEFAULT_SETTINGS.endpoint).toBe('');
      expect(DEFAULT_SETTINGS.apiKey).toBe('');
    });

    it('has a valid default model', () => {
      expect(AVAILABLE_MODELS).toContain(DEFAULT_SETTINGS.modelName);
    });
  });
});
