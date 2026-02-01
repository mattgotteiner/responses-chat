export interface FormatDateOptions {
  /** Locale for formatting (default: 'en-US') */
  locale?: string;
  /** Include time in output */
  includeTime?: boolean;
  /** Date style: 'full', 'long', 'medium', 'short' */
  dateStyle?: 'full' | 'long' | 'medium' | 'short';
}

/**
 * Formats a Date object into a human-readable string.
 *
 * @example
 * ```ts
 * formatDate(new Date('2024-01-15'))
 * // => "January 15, 2024"
 *
 * formatDate(new Date('2024-01-15'), { includeTime: true })
 * // => "January 15, 2024 at 12:00 AM"
 * ```
 */
export function formatDate(
  date: Date,
  options: FormatDateOptions = {}
): string {
  const { locale = 'en-US', includeTime = false, dateStyle = 'long' } = options;

  if (includeTime) {
    return date.toLocaleString(locale, {
      dateStyle,
      timeStyle: 'short',
    });
  }

  return date.toLocaleDateString(locale, {
    dateStyle,
  });
}

/**
 * Returns a relative time string (e.g., "2 days ago", "in 3 hours").
 *
 * @example
 * ```ts
 * const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
 * getRelativeTime(yesterday)
 * // => "1 day ago"
 * ```
 */
export function getRelativeTime(date: Date, locale = 'en-US'): string {
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  const absoluteDiff = Math.abs(diffInSeconds);

  const units: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const { unit, seconds } of units) {
    if (absoluteDiff >= seconds) {
      const value = Math.floor(diffInSeconds / seconds);
      return rtf.format(value, unit);
    }
  }

  return rtf.format(0, 'second');
}
