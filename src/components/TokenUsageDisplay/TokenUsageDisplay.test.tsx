import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import type { TokenUsage } from '../../types';

const basicUsage: TokenUsage = {
  input_tokens: 100,
  output_tokens: 200,
  total_tokens: 300,
};

const detailedUsage: TokenUsage = {
  input_tokens: 1000,
  input_tokens_details: { cached_tokens: 250 },
  output_tokens: 2000,
  output_tokens_details: { reasoning_tokens: 1500 },
  total_tokens: 3000,
};

describe('TokenUsageDisplay', () => {
  describe('compact mode', () => {
    it('renders total tokens', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="compact" />);

      expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('renders input/output breakdown', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="compact" />);

      expect(screen.getByText('(100 in / 200 out)')).toBeInTheDocument();
    });

    it('renders tokens label', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="compact" />);

      expect(screen.getByText('Tokens:')).toBeInTheDocument();
    });

    it('formats large numbers with commas', () => {
      render(<TokenUsageDisplay usage={detailedUsage} mode="compact" />);

      expect(screen.getByText('3,000')).toBeInTheDocument();
      expect(screen.getByText('(1,000 in / 2,000 out)')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <TokenUsageDisplay usage={basicUsage} mode="compact" className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('detailed mode', () => {
    it('renders section header with icon', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="detailed" />);

      expect(screen.getByText('📊')).toBeInTheDocument();
      expect(screen.getByText('Token Usage')).toBeInTheDocument();
    });

    it('renders input tokens row', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="detailed" />);

      expect(screen.getByText('Input tokens')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('renders output tokens row', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="detailed" />);

      expect(screen.getByText('Output tokens')).toBeInTheDocument();
      expect(screen.getByText('200')).toBeInTheDocument();
    });

    it('renders total tokens row', () => {
      render(<TokenUsageDisplay usage={basicUsage} mode="detailed" />);

      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
    });

    it('shows cached tokens when present', () => {
      render(<TokenUsageDisplay usage={detailedUsage} mode="detailed" />);

      expect(screen.getByText('↳ Cached')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
    });

    it('shows reasoning tokens when present', () => {
      render(<TokenUsageDisplay usage={detailedUsage} mode="detailed" />);

      expect(screen.getByText('↳ Reasoning')).toBeInTheDocument();
      expect(screen.getByText('1,500')).toBeInTheDocument();
    });

    it('hides cached tokens when zero', () => {
      const usageWithZeroCached: TokenUsage = {
        ...basicUsage,
        input_tokens_details: { cached_tokens: 0 },
      };

      render(<TokenUsageDisplay usage={usageWithZeroCached} mode="detailed" />);

      expect(screen.queryByText('↳ Cached')).not.toBeInTheDocument();
    });

    it('hides reasoning tokens when zero', () => {
      const usageWithZeroReasoning: TokenUsage = {
        ...basicUsage,
        output_tokens_details: { reasoning_tokens: 0 },
      };

      render(<TokenUsageDisplay usage={usageWithZeroReasoning} mode="detailed" />);

      expect(screen.queryByText('↳ Reasoning')).not.toBeInTheDocument();
    });
  });

  describe('default mode', () => {
    it('defaults to compact mode', () => {
      render(<TokenUsageDisplay usage={basicUsage} />);

      // Compact mode shows inline breakdown
      expect(screen.getByText('(100 in / 200 out)')).toBeInTheDocument();
      // Detailed mode shows "Token Usage" header
      expect(screen.queryByText('Token Usage')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows em dash placeholder in compact mode when usage is undefined', () => {
      render(<TokenUsageDisplay usage={undefined} mode="compact" />);

      expect(screen.getByText('Tokens:')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('applies empty class in compact mode when usage is undefined', () => {
      const { container } = render(<TokenUsageDisplay usage={undefined} mode="compact" />);

      expect(container.firstChild).toHaveClass('token-usage--empty');
    });

    it('returns null in detailed mode when usage is undefined', () => {
      const { container } = render(<TokenUsageDisplay usage={undefined} mode="detailed" />);

      expect(container.firstChild).toBeNull();
    });
  });
});
