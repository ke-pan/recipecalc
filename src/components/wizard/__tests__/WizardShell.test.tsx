import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useEffect } from 'react';
import WizardShell from '../WizardShell';

// Mock the LemonSqueezy module so LicenseProvider (used inside WizardShell) can initialize
vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: vi.fn(),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// Mock step components — use useEffect to call onValidChange only once
vi.mock('../steps/Step1RecipeInfo', () => ({
  default: ({ onValidChange }: { onValidChange: (v: boolean) => void }) => {
    useEffect(() => { onValidChange(true); }, []);
    return <div data-testid="step1">Step 1 content</div>;
  },
}));

vi.mock('../steps/Step2Ingredients', () => ({
  default: ({ onValidChange }: { onValidChange: (v: boolean) => void }) => {
    useEffect(() => { onValidChange(true); }, []);
    return <div data-testid="step2">Step 2 content</div>;
  },
}));

vi.mock('../steps/Step3LaborOverhead', () => ({
  default: ({ onValidChange }: { onValidChange: (v: boolean) => void }) => {
    useEffect(() => { onValidChange(true); }, []);
    return <div data-testid="step3">Step 3 content</div>;
  },
}));

vi.mock('../steps/Step4Reveal', () => ({
  default: ({ editingRecipeId }: { editingRecipeId?: string | null }) => (
    <div data-testid="step4" data-editing-id={editingRecipeId ?? ''}>
      Step 4 content
      {editingRecipeId && <span data-testid="editing-id">{editingRecipeId}</span>}
    </div>
  ),
}));

vi.mock('../../../hooks/useRecipePersistence', () => ({
  useRecipePersistence: () => ({
    savedData: null,
    save: vi.fn(),
    clear: vi.fn(),
    dismiss: vi.fn(),
    showResume: false,
  }),
}));

const mockReadRecipes = vi.fn().mockReturnValue([]);
vi.mock('../../../hooks/useRecipes', () => ({
  readRecipes: (...args: unknown[]) => mockReadRecipes(...args),
}));

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

function clickNextAndWait() {
  fireEvent.click(screen.getByText('Next'));
  act(() => { vi.advanceTimersByTime(250); });
}

function clickBackAndWait() {
  fireEvent.click(screen.getByText('Back'));
  act(() => { vi.advanceTimersByTime(250); });
}

describe('WizardShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Rendering ---

  it('renders the wizard with header, content, and footer', () => {
    render(<WizardShell />);
    expect(screen.getByText('RecipeCalc')).toBeInTheDocument();
    expect(screen.getByTestId('step1')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('renders 4 step indicator dots', () => {
    render(<WizardShell />);
    const dots = screen.getAllByRole('button', { name: /Step \d of 4/ });
    expect(dots).toHaveLength(4);
  });

  it('starts on Step 1 with correct aria-current', () => {
    render(<WizardShell />);
    const step1Dot = screen.getByRole('button', { name: 'Step 1 of 4: Recipe Info' });
    expect(step1Dot).toHaveAttribute('aria-current', 'step');
  });

  // --- Navigation: Next/Back ---

  it('navigates to Step 2 when Next is clicked', () => {
    render(<WizardShell />);
    clickNextAndWait();
    expect(screen.getByTestId('step2')).toBeInTheDocument();
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
    expect(screen.getByTestId('step1')).toBeInTheDocument();
  });

  it('navigates through all 4 steps', () => {
    render(<WizardShell />);
    clickNextAndWait();
    expect(screen.getByTestId('step2')).toBeInTheDocument();
    clickNextAndWait();
    expect(screen.getByTestId('step3')).toBeInTheDocument();
    // Step 3 CTA is "See your true cost →"
    fireEvent.click(screen.getByText(/See your true cost/));
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByTestId('step4')).toBeInTheDocument();
  });

  // --- CTA label ---

  it('shows "See your true cost →" CTA on Step 3', () => {
    render(<WizardShell />);
    clickNextAndWait();
    clickNextAndWait();
    expect(screen.getByText(/See your true cost/)).toBeInTheDocument();
  });

  it('hides footer on Step 4 (reveal has its own actions)', () => {
    render(<WizardShell />);
    clickNextAndWait();
    clickNextAndWait();
    fireEvent.click(screen.getByText(/See your true cost/));
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  // --- Step Indicator ---

  it('highlights the current step dot', () => {
    render(<WizardShell />);
    const step1Dot = screen.getByRole('button', { name: 'Step 1 of 4: Recipe Info' });
    expect(step1Dot).toHaveClass('wizard-steps__dot--current');
    clickNextAndWait();
    const step2Dot = screen.getByRole('button', { name: 'Step 2 of 4: Ingredients' });
    expect(step2Dot).toHaveClass('wizard-steps__dot--current');
  });

  it('marks completed steps in the indicator', () => {
    render(<WizardShell />);
    clickNextAndWait();
    const step1Dot = screen.getByRole('button', { name: 'Step 1 of 4: Recipe Info' });
    expect(step1Dot).toHaveClass('wizard-steps__dot--completed');
  });

  it('allows clicking on a completed step dot to jump back', () => {
    render(<WizardShell />);
    clickNextAndWait();
    const step1Dot = screen.getByRole('button', { name: 'Step 1 of 4: Recipe Info' });
    expect(step1Dot).not.toBeDisabled();
    fireEvent.click(step1Dot);
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByTestId('step1')).toBeInTheDocument();
  });

  it('disables non-completed, non-current step dots', () => {
    render(<WizardShell />);
    const step3Dot = screen.getByRole('button', { name: 'Step 3 of 4: Labor & Overhead' });
    expect(step3Dot).toBeDisabled();
  });

  // --- Animation direction ---

  it('applies forward exit animation class when going next', () => {
    render(<WizardShell />);
    fireEvent.click(screen.getByText('Next'));
    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--exit-left')).toBe(true);
    act(() => { vi.advanceTimersByTime(250); });
  });

  it('applies backward exit animation class when going back', () => {
    render(<WizardShell />);
    clickNextAndWait();
    fireEvent.click(screen.getByText('Back'));
    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--exit-right')).toBe(true);
    act(() => { vi.advanceTimersByTime(250); });
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
    const content = document.querySelector('.wizard-content');
    expect(content?.classList.contains('wizard-content--exit-left')).toBe(false);
    expect(content?.classList.contains('wizard-content--enter')).toBe(true);
    expect(screen.getByTestId('step2')).toBeInTheDocument();
  });

  // --- Keyboard ---

  it('allows Enter key on the wizard container to trigger Next', () => {
    render(<WizardShell />);
    const wizard = document.querySelector('.wizard')!;
    fireEvent.keyDown(wizard, { key: 'Enter', target: wizard });
    act(() => { vi.advanceTimersByTime(250); });
    expect(screen.getByTestId('step2')).toBeInTheDocument();
  });

  // --- Aria labels ---

  it('sets correct aria-labels on all step dots', () => {
    render(<WizardShell />);
    expect(screen.getByRole('button', { name: 'Step 1 of 4: Recipe Info' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 2 of 4: Ingredients' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 3 of 4: Labor & Overhead' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Step 4 of 4: Your True Cost' })).toBeInTheDocument();
  });

  it('sets aria-label on Back button', () => {
    render(<WizardShell />);
    clickNextAndWait();
    expect(screen.getByRole('button', { name: 'Go to previous step' })).toBeInTheDocument();
  });

  it('sets aria-label on Next button', () => {
    render(<WizardShell />);
    expect(screen.getByRole('button', { name: 'Go to next step' })).toBeInTheDocument();
  });

  // --- Step 4 data-step attribute ---

  it('applies data-step attribute for reveal background on Step 4', () => {
    render(<WizardShell />);
    clickNextAndWait();
    clickNextAndWait();
    fireEvent.click(screen.getByText(/See your true cost/));
    act(() => { vi.advanceTimersByTime(250); });
    const content = document.querySelector('.wizard-content');
    expect(content?.getAttribute('data-step')).toBe('3');
  });

  // --- ?edit=<id> flow ---

  describe('edit recipe via ?edit=<id>', () => {
    const savedRecipe = {
      id: 'saved-recipe-123',
      version: 1,
      savedAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
      recipe: {
        name: 'Saved Cookies',
        quantity: 12,
        quantityUnit: 'cookies',
        batchTimeHours: 1,
        ingredients: [],
        laborAndOverhead: { hourlyRate: 15, packaging: 2, overhead: 1, platformFees: 0 },
      },
      targetCostRatio: 0.35,
    };

    let originalLocation: Location;

    beforeEach(() => {
      originalLocation = window.location;
    });

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
      mockReadRecipes.mockReturnValue([]);
    });

    it('loads saved recipe and jumps to step 4 when ?edit=<id> matches', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, search: '?edit=saved-recipe-123' },
      });
      mockReadRecipes.mockReturnValue([savedRecipe]);

      render(<WizardShell />);
      act(() => { vi.advanceTimersByTime(250); });

      // Should jump to step 4
      expect(screen.getByTestId('step4')).toBeInTheDocument();
    });

    it('passes editingRecipeId to Step4Reveal', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, search: '?edit=saved-recipe-123' },
      });
      mockReadRecipes.mockReturnValue([savedRecipe]);

      render(<WizardShell />);
      act(() => { vi.advanceTimersByTime(250); });

      expect(screen.getByTestId('editing-id')).toHaveTextContent('saved-recipe-123');
    });

    it('stays on step 1 when ?edit=<id> does not match any saved recipe', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, search: '?edit=nonexistent-id' },
      });
      mockReadRecipes.mockReturnValue([savedRecipe]);

      render(<WizardShell />);
      act(() => { vi.advanceTimersByTime(250); });

      expect(screen.getByTestId('step1')).toBeInTheDocument();
    });

    it('stays on step 1 when no ?edit param is present', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, search: '' },
      });

      render(<WizardShell />);
      act(() => { vi.advanceTimersByTime(250); });

      expect(screen.getByTestId('step1')).toBeInTheDocument();
    });

    it('does not pass editingRecipeId when no ?edit param', () => {
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, search: '' },
      });

      render(<WizardShell />);
      act(() => { vi.advanceTimersByTime(250); });

      // Navigate to step 4 normally
      clickNextAndWait();
      clickNextAndWait();
      fireEvent.click(screen.getByText(/See your true cost/));
      act(() => { vi.advanceTimersByTime(250); });

      expect(screen.getByTestId('step4')).toBeInTheDocument();
      expect(screen.queryByTestId('editing-id')).not.toBeInTheDocument();
    });
  });
});
