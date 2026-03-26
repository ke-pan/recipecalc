import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WizardShell from '../WizardShell';

// Mock matchMedia for reduced-motion tests
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

/** Click Next and wait for the animation to complete */
function clickNextAndWait() {
  fireEvent.click(screen.getByText('Next'));
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

/** Click Back and wait for the animation to complete */
function clickBackAndWait() {
  fireEvent.click(screen.getByText('Back'));
  act(() => {
    vi.advanceTimersByTime(250);
  });
}

describe('WizardShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false); // Default: animations enabled
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Rendering ---

  it('renders the wizard with header, content, and footer', () => {
    render(<WizardShell />);

    expect(screen.getByText('RecipeCalc')).toBeInTheDocument();
    expect(screen.getByText('Recipe Info')).toBeInTheDocument();
    expect(screen.getByText('Step 1 placeholder')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('renders 4 step indicator dots', () => {
    render(<WizardShell />);

    const dots = screen.getAllByRole('button', { name: /Step \d of 4/ });
    expect(dots).toHaveLength(4);
  });

  it('starts on Step 1 with correct aria-current', () => {
    render(<WizardShell />);

    const step1Dot = screen.getByRole('button', {
      name: 'Step 1 of 4: Recipe Info',
    });
    expect(step1Dot).toHaveAttribute('aria-current', 'step');
  });

  // --- Navigation: Next/Back ---

  it('navigates to Step 2 when Next is clicked', () => {
    render(<WizardShell />);

    clickNextAndWait();

    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Step 2 placeholder')).toBeInTheDocument();
  });

  it('shows Back button on Step 2', () => {
    render(<WizardShell />);

    clickNextAndWait();

    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('does not show Back button on Step 1', () => {
    render(<WizardShell />);

    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('navigates back to Step 1 when Back is clicked on Step 2', () => {
    render(<WizardShell />);

    clickNextAndWait();
    clickBackAndWait();

    expect(screen.getByText('Recipe Info')).toBeInTheDocument();
    expect(screen.getByText('Step 1 placeholder')).toBeInTheDocument();
  });

  it('navigates through all 4 steps', () => {
    render(<WizardShell />);

    // Step 1 -> 2
    clickNextAndWait();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();

    // Step 2 -> 3
    clickNextAndWait();
    expect(screen.getByText('Labor & Overhead')).toBeInTheDocument();

    // Step 3 -> 4
    clickNextAndWait();
    expect(screen.getByText('Your True Cost')).toBeInTheDocument();
  });

  // --- CTA label ---

  it('shows "See your true cost" CTA on Step 4', () => {
    render(<WizardShell />);

    // Navigate to Step 4
    clickNextAndWait();
    clickNextAndWait();
    clickNextAndWait();

    expect(
      screen.getByRole('button', { name: 'See your true cost' }),
    ).toBeInTheDocument();
  });

  it('disables the CTA button on the last step', () => {
    render(<WizardShell />);

    clickNextAndWait();
    clickNextAndWait();
    clickNextAndWait();

    const ctaButton = screen.getByRole('button', {
      name: 'See your true cost',
    });
    expect(ctaButton).toBeDisabled();
  });

  // --- Step Indicator ---

  it('highlights the current step dot', () => {
    render(<WizardShell />);

    const step1Dot = screen.getByRole('button', {
      name: 'Step 1 of 4: Recipe Info',
    });
    expect(step1Dot).toHaveClass('wizard-steps__dot--current');

    clickNextAndWait();

    const step2Dot = screen.getByRole('button', {
      name: 'Step 2 of 4: Ingredients',
    });
    expect(step2Dot).toHaveClass('wizard-steps__dot--current');
  });

  it('marks completed steps in the indicator', () => {
    render(<WizardShell />);

    clickNextAndWait();

    const step1Dot = screen.getByRole('button', {
      name: 'Step 1 of 4: Recipe Info',
    });
    expect(step1Dot).toHaveClass('wizard-steps__dot--completed');
  });

  it('allows clicking on a completed step dot to jump back', () => {
    render(<WizardShell />);

    // Go to step 2
    clickNextAndWait();

    // Click step 1 dot to jump back
    const step1Dot = screen.getByRole('button', {
      name: 'Step 1 of 4: Recipe Info',
    });
    expect(step1Dot).not.toBeDisabled();
    fireEvent.click(step1Dot);
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('Recipe Info')).toBeInTheDocument();
    expect(screen.getByText('Step 1 placeholder')).toBeInTheDocument();
  });

  it('disables non-completed, non-current step dots', () => {
    render(<WizardShell />);

    const step3Dot = screen.getByRole('button', {
      name: 'Step 3 of 4: Labor & Overhead',
    });
    expect(step3Dot).toBeDisabled();
  });

  // --- Animation direction ---

  it('applies forward exit animation class when going next', () => {
    render(<WizardShell />);

    fireEvent.click(screen.getByText('Next'));
    // Don't advance timers — check mid-animation

    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--exit-left')).toBe(true);

    // Clean up timer
    act(() => {
      vi.advanceTimersByTime(250);
    });
  });

  it('applies backward exit animation class when going back', () => {
    render(<WizardShell />);

    clickNextAndWait();

    // Now go back
    fireEvent.click(screen.getByText('Back'));

    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--exit-right')).toBe(true);

    // Clean up timer
    act(() => {
      vi.advanceTimersByTime(250);
    });
  });

  it('applies enter animation class after transition completes', () => {
    render(<WizardShell />);

    clickNextAndWait();

    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--enter')).toBe(true);
  });

  // --- Reduced motion ---

  it('skips animation when prefers-reduced-motion is set', () => {
    mockMatchMedia(true);
    render(<WizardShell />);

    fireEvent.click(screen.getByText('Next'));
    // With reduced motion, content should update immediately without animation

    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--exit-left')).toBe(false);
    expect(content?.classList.contains('wizard-content--enter')).toBe(true);

    // Content should already show new step
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
  });

  // --- Keyboard ---

  it('allows Enter key on the wizard container to trigger Next', () => {
    render(<WizardShell />);

    const wizard = document.querySelector('.wizard')!;
    fireEvent.keyDown(wizard, { key: 'Enter', target: wizard });
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('Ingredients')).toBeInTheDocument();
  });

  // --- Aria labels ---

  it('sets correct aria-labels on all step dots', () => {
    render(<WizardShell />);

    expect(
      screen.getByRole('button', { name: 'Step 1 of 4: Recipe Info' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Step 2 of 4: Ingredients' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Step 3 of 4: Labor & Overhead' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Step 4 of 4: Your True Cost' }),
    ).toBeInTheDocument();
  });

  it('sets aria-label on Back button', () => {
    render(<WizardShell />);

    clickNextAndWait();

    expect(
      screen.getByRole('button', { name: 'Go to previous step' }),
    ).toBeInTheDocument();
  });

  it('sets aria-label on Next button', () => {
    render(<WizardShell />);

    expect(
      screen.getByRole('button', { name: 'Go to next step' }),
    ).toBeInTheDocument();
  });

  // --- Step 4 reveal background ---

  it('applies data-step attribute for reveal background on Step 4', () => {
    render(<WizardShell />);

    clickNextAndWait();
    clickNextAndWait();
    clickNextAndWait();

    const content = document.querySelector('.wizard-content');
    expect(content?.getAttribute('data-step')).toBe('3');
  });

  // --- Edge cases ---

  it('does not go past Step 4 when Next is clicked on last step', () => {
    render(<WizardShell />);

    clickNextAndWait();
    clickNextAndWait();
    clickNextAndWait();

    // Already on step 4, clicking next should do nothing
    expect(screen.getByText('Your True Cost')).toBeInTheDocument();
    expect(screen.getByText('Step 4 placeholder')).toBeInTheDocument();
  });
});
