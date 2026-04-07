import { useEffect, useRef, type RefObject } from 'react';

function clampZoom(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function snapZoom(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function getTouchDistance(touches: TouchList): number | null {
  if (touches.length !== 2) {
    return null;
  }

  const [firstTouch, secondTouch] = [touches[0], touches[1]];
  const deltaX = secondTouch.clientX - firstTouch.clientX;
  const deltaY = secondTouch.clientY - firstTouch.clientY;
  return Math.hypot(deltaX, deltaY);
}

interface UsePinchZoomOptions {
  /** Whether pinch handling should be active */
  enabled: boolean;
  /** Current zoom value */
  value: number;
  /** Minimum allowed zoom value */
  min: number;
  /** Maximum allowed zoom value */
  max: number;
  /** Increment to snap pinch results to */
  step: number;
  /** Called when the gesture produces a new zoom value */
  onChange: (nextValue: number) => void;
}

/**
 * Adds two-finger pinch zoom handling to a target element.
 *
 * @returns Nothing. The hook attaches and cleans up DOM listeners on the provided ref.
 *
 * @example
 * const ref = useRef<HTMLDivElement | null>(null);
 * usePinchZoom(ref, {
 *   enabled: true,
 *   value: zoom,
 *   min: 80,
 *   max: 200,
 *   step: 5,
 *   onChange: setZoom,
 * });
 */
export function usePinchZoom(
  targetRef: RefObject<HTMLElement | null>,
  { enabled, value, min, max, step, onChange }: UsePinchZoomOptions
): void {
  const gestureRef = useRef<{ startDistance: number; startValue: number } | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const element = targetRef.current;
    if (!enabled || !element) {
      return;
    }

    const handleTouchStart = (event: TouchEvent) => {
      const startDistance = getTouchDistance(event.touches);
      if (startDistance === null || startDistance === 0) {
        if (event.touches.length < 2) {
          gestureRef.current = null;
        }
        return;
      }

      gestureRef.current = {
        startDistance,
        startValue: valueRef.current,
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.touches.length !== 2) {
        return;
      }

      const distance = getTouchDistance(event.touches);
      if (distance === null || gesture.startDistance === 0) {
        return;
      }

      event.preventDefault();

      const rawValue = gesture.startValue * (distance / gesture.startDistance);
      const nextValue = snapZoom(clampZoom(rawValue, min, max), step);
      if (nextValue !== valueRef.current) {
        onChangeRef.current(nextValue);
      }
    };

    const handleTouchEnd = () => {
      gestureRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, max, min, step, targetRef]);
}
