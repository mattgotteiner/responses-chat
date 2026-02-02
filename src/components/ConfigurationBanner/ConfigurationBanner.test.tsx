import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigurationBanner } from './ConfigurationBanner';

describe('ConfigurationBanner', () => {
  it('renders warning message', () => {
    render(<ConfigurationBanner onConfigureClick={() => {}} />);
    
    expect(screen.getByText(/Settings required/)).toBeInTheDocument();
    expect(screen.getByText(/Enter your Azure OpenAI endpoint and API key/)).toBeInTheDocument();
  });

  it('renders Open Settings button', () => {
    render(<ConfigurationBanner onConfigureClick={() => {}} />);
    
    expect(screen.getByRole('button', { name: /Open Settings/i })).toBeInTheDocument();
  });

  it('calls onConfigureClick when button is clicked', () => {
    const handleClick = vi.fn();
    render(<ConfigurationBanner onConfigureClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Open Settings/i }));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('has role="alert" for accessibility', () => {
    render(<ConfigurationBanner onConfigureClick={() => {}} />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
