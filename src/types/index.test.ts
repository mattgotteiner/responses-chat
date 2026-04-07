import { describe, it, expect } from 'vitest';
import {
  AVAILABLE_MODELS,
  MODEL_REASONING_EFFORTS,
  getReasoningEfforts,
  supportsSamplingControls,
  VERBOSITY_OPTIONS,
  REASONING_SUMMARY_OPTIONS,
  DEFAULT_SETTINGS,
  extractTokenUsage,
  DEFAULT_OUTPUT_TEXT_ZOOM,
  OUTPUT_TEXT_ZOOM_MAX,
  OUTPUT_TEXT_ZOOM_MIN,
  OUTPUT_TEXT_ZOOM_STEP,
} from './index';

describe('types constants', () => {
  describe('AVAILABLE_MODELS', () => {
    it('contains the expected built-in models', () => {
      expect(AVAILABLE_MODELS).toContain('gpt-5-nano');
      expect(AVAILABLE_MODELS).toContain('gpt-5-mini');
      expect(AVAILABLE_MODELS).toContain('gpt-5');
      expect(AVAILABLE_MODELS).toContain('gpt-5.1');
      expect(AVAILABLE_MODELS).toContain('gpt-5.2');
      expect(AVAILABLE_MODELS).toContain('gpt-5.4-nano');
      expect(AVAILABLE_MODELS).toContain('gpt-5.4-mini');
      expect(AVAILABLE_MODELS).toContain('gpt-5.4');
      expect(AVAILABLE_MODELS).not.toContain('gpt-oss-120b');
    });
  });

  describe('MODEL_REASONING_EFFORTS', () => {
    it('has per-model reasoning effort configurations', () => {
      expect(MODEL_REASONING_EFFORTS['gpt-5-nano']).toEqual(['low', 'medium', 'high']);
      expect(MODEL_REASONING_EFFORTS['gpt-5.4-nano']).toEqual(['none', 'low', 'medium', 'high']);
      expect(MODEL_REASONING_EFFORTS['gpt-5.4-mini']).toEqual(['none', 'low', 'medium', 'high']);
      expect(MODEL_REASONING_EFFORTS['gpt-5']).toContain('minimal');
      expect(MODEL_REASONING_EFFORTS['gpt-5.1']).toContain('none');
    });

    it('all AVAILABLE_MODELS support low, medium, high effort via getReasoningEfforts', () => {
      for (const model of AVAILABLE_MODELS) {
        const efforts = getReasoningEfforts(model);
        expect(efforts).toContain('low');
        expect(efforts).toContain('medium');
        expect(efforts).toContain('high');
      }
    });

    it('returns default efforts for unknown models', () => {
      const efforts = getReasoningEfforts('some-unknown-model');
      expect(efforts).toContain('low');
      expect(efforts).toContain('medium');
      expect(efforts).toContain('high');
    });
  });

  describe('supportsSamplingControls', () => {
    it('returns true for gpt-5.2 when reasoning effort is none', () => {
      expect(supportsSamplingControls('gpt-5.2', 'none')).toBe(true);
    });

    it('returns true for gpt-5.4 when reasoning effort is none', () => {
      expect(supportsSamplingControls('gpt-5.4', 'none')).toBe(true);
    });

    it('returns true for gpt-5.1 when reasoning effort is none', () => {
      expect(supportsSamplingControls('gpt-5.1', 'none')).toBe(true);
    });

    it('returns true for gpt-5.4-mini when reasoning effort is none', () => {
      expect(supportsSamplingControls('gpt-5.4-mini', 'none')).toBe(true);
    });

    it('returns false for models that do not support none', () => {
      expect(supportsSamplingControls('gpt-5-mini', 'none')).toBe(false);
    });

    it('returns false when reasoning effort is not none', () => {
      expect(supportsSamplingControls('gpt-5.2', 'minimal')).toBe(false);
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
      expect(DEFAULT_SETTINGS).toHaveProperty('outputTextZoom');
    });

    it('has empty credentials and model by default', () => {
      expect(DEFAULT_SETTINGS.endpoint).toBe('');
      expect(DEFAULT_SETTINGS.apiKey).toBe('');
      expect(DEFAULT_SETTINGS.modelName).toBe('');
      expect(DEFAULT_SETTINGS.temperature).toBeUndefined();
      expect(DEFAULT_SETTINGS.topP).toBeUndefined();
      expect(DEFAULT_SETTINGS.outputTextZoom).toBe(DEFAULT_OUTPUT_TEXT_ZOOM);
    });
  });

  describe('output text zoom constants', () => {
    it('defines ascending min/default/max bounds', () => {
      expect(OUTPUT_TEXT_ZOOM_MIN).toBeLessThan(DEFAULT_OUTPUT_TEXT_ZOOM);
      expect(DEFAULT_OUTPUT_TEXT_ZOOM).toBeLessThan(OUTPUT_TEXT_ZOOM_MAX);
      expect(OUTPUT_TEXT_ZOOM_STEP).toBeGreaterThan(0);
    });
  });

  describe('extractTokenUsage', () => {
    it('extracts valid token usage from response JSON', () => {
      const responseJson = {
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
      };

      const result = extractTokenUsage(responseJson);

      expect(result).toEqual({
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        input_tokens_details: undefined,
        output_tokens_details: undefined,
      });
    });

    it('extracts token details when present', () => {
      const responseJson = {
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 50 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 150 },
          total_tokens: 300,
        },
      };

      const result = extractTokenUsage(responseJson);

      expect(result?.input_tokens_details?.cached_tokens).toBe(50);
      expect(result?.output_tokens_details?.reasoning_tokens).toBe(150);
    });

    it('returns undefined for undefined input', () => {
      expect(extractTokenUsage(undefined)).toBeUndefined();
    });

    it('returns undefined for null input', () => {
      expect(extractTokenUsage(null as unknown as Record<string, unknown>)).toBeUndefined();
    });

    it('returns undefined when usage is missing', () => {
      expect(extractTokenUsage({})).toBeUndefined();
    });

    it('returns undefined when usage has wrong type', () => {
      expect(extractTokenUsage({ usage: 'invalid' })).toBeUndefined();
    });

    it('returns undefined when required fields are missing', () => {
      expect(extractTokenUsage({ usage: { input_tokens: 100 } })).toBeUndefined();
    });

    it('returns undefined when fields have wrong types', () => {
      expect(
        extractTokenUsage({
          usage: {
            input_tokens: '100',
            output_tokens: 200,
            total_tokens: 300,
          },
        })
      ).toBeUndefined();
    });
  });
});
