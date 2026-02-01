import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button label="Click me" onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button label="Disabled" onClick={() => {}} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant class', () => {
    render(<Button label="Secondary" onClick={() => {}} variant="secondary" />);
    expect(screen.getByRole('button')).toHaveClass('button--secondary');
  });
});
