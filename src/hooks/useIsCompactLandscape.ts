import { useMediaQuery } from './useMediaQuery';

const COMPACT_LANDSCAPE_QUERY =
  '(orientation: landscape) and (max-height: 500px) and (hover: none) and (pointer: coarse)';

/**
 * React hook that returns whether the UI should switch to the compact mobile landscape layout.
 *
 * This mode is intended for short, touch-first landscape viewports where the chat
 * composer would otherwise crowd out the message area.
 *
 * @returns {boolean} `true` when the viewport should use the compact landscape layout.
 *
 * @example
 * ```tsx
 * import { useIsCompactLandscape } from '../hooks/useIsCompactLandscape';
 *
 * function ChatShell() {
 *   const isCompactLandscape = useIsCompactLandscape();
 *
 *   return <div data-compact={isCompactLandscape}>...</div>;
 * }
 * ```
 */
export function useIsCompactLandscape(): boolean {
  return useMediaQuery(COMPACT_LANDSCAPE_QUERY);
}
