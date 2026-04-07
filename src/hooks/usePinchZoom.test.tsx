import { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePinchZoom } from './usePinchZoom';

interface HarnessProps {
  enabled?: boolean;
  value?: number;
  onChange?: (value: number) => void;
}

function createTouchList(points: Array<{ clientX: number; clientY: number }>): TouchList {
  return points.map((point, index) => ({
    identifier: index,
    clientX: point.clientX,
    clientY: point.clientY,
  })) as unknown as TouchList;
}

function dispatchTouchEvent(
  target: HTMLElement,
  type: 'touchstart' | 'touchmove' | 'touchend',
  points: Array<{ clientX: number; clientY: number }>
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: createTouchList(points),
  });
  target.dispatchEvent(event);
}

function Harness({ enabled = true, value = 100, onChange = vi.fn() }: HarnessProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  usePinchZoom(ref, {
    enabled,
    value,
    min: 80,
    max: 200,
    step: 5,
    onChange,
  });

  return <div ref={ref} data-testid="pinch-target" />;
}

describe('usePinchZoom', () => {
  it('updates zoom from a two-finger pinch gesture', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const target = screen.getByTestId('pinch-target');
    dispatchTouchEvent(target, 'touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 100 },
    ]);
    dispatchTouchEvent(target, 'touchmove', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 150 },
    ]);

    expect(onChange).toHaveBeenCalledWith(150);
  });

  it('clamps zoom to the configured maximum', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const target = screen.getByTestId('pinch-target');
    dispatchTouchEvent(target, 'touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 100 },
    ]);
    dispatchTouchEvent(target, 'touchmove', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 260 },
    ]);

    expect(onChange).toHaveBeenCalledWith(200);
  });

  it('ignores non-pinch touches', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const target = screen.getByTestId('pinch-target');
    dispatchTouchEvent(target, 'touchstart', [{ clientX: 0, clientY: 0 }]);
    dispatchTouchEvent(target, 'touchmove', [{ clientX: 0, clientY: 120 }]);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const onChange = vi.fn();
    render(<Harness enabled={false} onChange={onChange} />);

    const target = screen.getByTestId('pinch-target');
    dispatchTouchEvent(target, 'touchstart', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 100 },
    ]);
    dispatchTouchEvent(target, 'touchmove', [
      { clientX: 0, clientY: 0 },
      { clientX: 0, clientY: 160 },
    ]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
