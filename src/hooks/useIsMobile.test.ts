import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMatchMediaMock(matches: boolean) {
  const listeners = new Set<ChangeHandler>();
  const mql = {
    matches,
    addEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      listeners.add(handler);
    }),
    removeEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      listeners.delete(handler);
    }),
    trigger(newMatches: boolean) {
      listeners.forEach((l) => l({ matches: newMatches } as MediaQueryListEvent));
    },
  };
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockReturnValue(mql),
    writable: true,
    configurable: true,
  });
  return mql;
}

describe('useIsMobile', () => {
  it('returns false on wide viewport', () => {
    createMatchMediaMock(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true on narrow viewport', () => {
    createMatchMediaMock(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates from wide to narrow when viewport changes', () => {
    const mql = createMatchMediaMock(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.trigger(true);
    });

    expect(result.current).toBe(true);
  });

  it('updates from narrow to wide when viewport changes', () => {
    const mql = createMatchMediaMock(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      mql.trigger(false);
    });

    expect(result.current).toBe(false);
  });

  it('removes event listener on unmount', () => {
    const mql = createMatchMediaMock(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
