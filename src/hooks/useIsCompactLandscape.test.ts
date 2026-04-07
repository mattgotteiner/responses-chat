import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIsCompactLandscape } from './useIsCompactLandscape';

type ChangeHandler = (event: MediaQueryListEvent) => void;

function createMatchMediaMock(matches: boolean) {
  const listeners = new Set<ChangeHandler>();
  const mediaQueryList = {
    matches,
    addEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      listeners.add(handler);
    }),
    removeEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      listeners.delete(handler);
    }),
    trigger(nextMatches: boolean) {
      mediaQueryList.matches = nextMatches;
      listeners.forEach((listener) =>
        listener({ matches: nextMatches } as MediaQueryListEvent)
      );
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockReturnValue(mediaQueryList),
    writable: true,
    configurable: true,
  });

  return mediaQueryList;
}

describe('useIsCompactLandscape', () => {
  it('returns false when the compact landscape query does not match', () => {
    createMatchMediaMock(false);

    const { result } = renderHook(() => useIsCompactLandscape());

    expect(result.current).toBe(false);
  });

  it('returns true when the compact landscape query matches', () => {
    createMatchMediaMock(true);

    const { result } = renderHook(() => useIsCompactLandscape());

    expect(result.current).toBe(true);
  });

  it('updates when the viewport enters compact landscape mode', () => {
    const mediaQueryList = createMatchMediaMock(false);
    const { result } = renderHook(() => useIsCompactLandscape());

    act(() => {
      mediaQueryList.trigger(true);
    });

    expect(result.current).toBe(true);
  });

  it('removes the listener on unmount', () => {
    const mediaQueryList = createMatchMediaMock(false);
    const { unmount } = renderHook(() => useIsCompactLandscape());

    unmount();

    expect(mediaQueryList.removeEventListener).toHaveBeenCalled();
  });
});
