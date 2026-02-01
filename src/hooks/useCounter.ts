import { useState, useCallback } from 'react';

interface UseCounterOptions {
  /** Initial count value */
  initialValue?: number;
  /** Minimum value (optional) */
  min?: number;
  /** Maximum value (optional) */
  max?: number;
  /** Step size for increment/decrement */
  step?: number;
}

interface UseCounterReturn {
  /** Current count value */
  count: number;
  /** Increment by step */
  increment: () => void;
  /** Decrement by step */
  decrement: () => void;
  /** Reset to initial value */
  reset: () => void;
  /** Set to specific value */
  setCount: (value: number) => void;
}

/**
 * A custom hook for managing a counter with optional min/max bounds.
 *
 * @example
 * ```tsx
 * const { count, increment, decrement, reset } = useCounter({ initialValue: 0 });
 * ```
 */
export function useCounter({
  initialValue = 0,
  min,
  max,
  step = 1,
}: UseCounterOptions = {}): UseCounterReturn {
  const [count, setCountState] = useState(initialValue);

  const setCount = useCallback(
    (value: number) => {
      setCountState((prev) => {
        let newValue = value;
        if (min !== undefined && newValue < min) newValue = min;
        if (max !== undefined && newValue > max) newValue = max;
        return newValue !== prev ? newValue : prev;
      });
    },
    [min, max]
  );

  const increment = useCallback(() => {
    setCount(count + step);
  }, [count, step, setCount]);

  const decrement = useCallback(() => {
    setCount(count - step);
  }, [count, step, setCount]);

  const reset = useCallback(() => {
    setCountState(initialValue);
  }, [initialValue]);

  return { count, increment, decrement, reset, setCount };
}
