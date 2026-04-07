import { useCallback, useSyncExternalStore } from 'react';

/**
 * React hook that subscribes to a CSS media query and returns whether it matches.
 *
 * The hook reads the initial `matchMedia()` state during render, then keeps the
 * value synchronized as the query result changes.
 *
 * @param {string} query CSS media query string to evaluate.
 * @returns {boolean} `true` when the media query currently matches.
 *
 * @example
 * ```tsx
 * import { useMediaQuery } from '../hooks/useMediaQuery';
 *
 * function Layout() {
 *   const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
 *
 *   return <div>{prefersDark ? 'Dark' : 'Light'}</div>;
 * }
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', onStoreChange);

      return () => {
        mediaQueryList.removeEventListener('change', onStoreChange);
      };
    },
    [query]
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
