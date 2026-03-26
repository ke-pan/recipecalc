import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestIsland from './TestIsland';

describe('TestIsland', () => {
  it('renders with initial count of 0', () => {
    render(<TestIsland />);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });

  it('increments count when button is clicked', () => {
    render(<TestIsland />);
    const button = screen.getByText('Increment');
    fireEvent.click(button);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('displays the React Island is working message', () => {
    render(<TestIsland />);
    expect(screen.getByText('React Island is working.')).toBeInTheDocument();
  });
});
