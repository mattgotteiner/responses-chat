import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, getRelativeTime } from './formatDate';

describe('formatDate', () => {
  it('formats date with default options', () => {
    const date = new Date('2024-01-15T12:00:00');
    const result = formatDate(date);
    expect(result).toBe('January 15, 2024');
  });

  it('formats date with short style', () => {
    const date = new Date('2024-01-15T12:00:00');
    const result = formatDate(date, { dateStyle: 'short' });
    expect(result).toBe('1/15/24');
  });

  it('includes time when specified', () => {
    const date = new Date('2024-01-15T14:30:00');
    const result = formatDate(date, { includeTime: true });
    expect(result).toContain('January 15, 2024');
    expect(result).toMatch(/2:30\s*PM/);
  });
});

describe('getRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "yesterday" for 1 day ago', () => {
    const yesterday = new Date('2024-06-14T12:00:00');
    expect(getRelativeTime(yesterday)).toBe('yesterday');
  });

  it('returns "tomorrow" for 1 day from now', () => {
    const tomorrow = new Date('2024-06-16T12:00:00');
    expect(getRelativeTime(tomorrow)).toBe('tomorrow');
  });

  it('returns days ago for multiple days', () => {
    const threeDaysAgo = new Date('2024-06-12T12:00:00');
    expect(getRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns hours for recent times', () => {
    const twoHoursAgo = new Date('2024-06-15T10:00:00');
    expect(getRelativeTime(twoHoursAgo)).toBe('2 hours ago');
  });
});
