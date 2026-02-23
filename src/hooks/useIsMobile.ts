import { useState, useEffect } from 'react';

const MOBILE_QUERY = '(max-width: 600px)';

/**
 * React hook that returns whether the current viewport matches the mobile breakpoint.
 *
 * This hook listens for changes to the `(max-width: 600px)` media query and updates
 * its value whenever the viewport crosses that threshold.
 *
 * @returns {boolean} `true` if the viewport width is considered mobile, otherwise `false`.
 *
 * @example
 * ```tsx
 * import { useIsMobile } from '../hooks/useIsMobile';
 *
 * function Layout() {
 *   const isMobile = useIsMobile();
 *
 *   return (
 *     <div>
 *       {isMobile ? (
 *         <MobileNavigation />
 *       ) : (
 *         <DesktopNavigation />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
