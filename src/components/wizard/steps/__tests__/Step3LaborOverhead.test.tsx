import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Step3LaborOverhead from '../Step3LaborOverhead';
import type { Recipe } from '../../../../lib/calc/types';

// ---------------------------------------------------------------------------
// Mock LicenseContext
// ---------------------------------------------------------------------------

let mockIsUnlocked = false;

vi.mock('../../../../contexts/LicenseContext.js', () => ({
  useLicense: () => ({
    isUnlocked: mockIsUnlocked,
    license: mockIsUnlocked ? { key: 'test' } : null,
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Mock useDefaults
// ---------------------------------------------------------------------------

let mockDefaults = {
  hourlyRate: 0,
  packaging: 0,
  overhead: 0,
  platformFees: 0,
};

vi.mock('../../../../hooks/useDefaults.js', () => ({
  useDefaults: () => ({
    defaults: mockDefaults,
    update: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal recipe for testing */
function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    name: 'Test Cookies',
    quantity: 24,
    quantityUnit: 'cookies',
    batchTimeHours: 2.5,
    ingredients: [],
    laborAndOverhead: {
      hourlyRate: 0,
      packaging: 0,
      overhead: 0,
      platformFees: 0,
    },
    ...overrides,
  };
}

function renderStep3(
  recipeOverrides: Partial<Recipe> = {},
  onUpdate = vi.fn(),
  onValidChange = vi.fn(),
) {
  const recipe = makeRecipe(recipeOverrides);
  return {
    recipe,
    onUpdate,
    onValidChange,
    ...render(
      <Step3LaborOverhead
        recipe={recipe}
        onUpdate={onUpdate}
        onValidChange={onValidChange}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockIsUnlocked = false;
  mockDefaults = {
    hourlyRate: 0,
    packaging: 0,
    overhead: 0,
    platformFees: 0,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step3LaborOverhead', () => {
  // --- Rendering ---

  it('renders the title and subtitle', () => {
    renderStep3();

    expect(screen.getByText('Labor & Overhead')).toBeInTheDocument();
    expect(
      screen.getByText('Add your time, packaging, and operating costs.'),
    ).toBeInTheDocument();
  });

  it('renders all form fields with labels', () => {
    renderStep3();

    expect(screen.getByLabelText(/Hourly rate/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Labor time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Packaging/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Overhead/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Platform fees/)).toBeInTheDocument();
  });

  it('renders the static tip', () => {
    renderStep3();

    expect(
      screen.getByText(
        'Industry average: labor + overhead = 40-60% of total cost.',
      ),
    ).toBeInTheDocument();
  });

  // --- Pre-fill labor time from batchTimeHours ---

  it('pre-fills labor time from recipe.batchTimeHours', () => {
    renderStep3({ batchTimeHours: 3.5 });

    const laborTimeInput = screen.getByLabelText(/Labor time/) as HTMLInputElement;
    expect(laborTimeInput.value).toBe('3.5');
  });

  // --- Labor cost live preview ---

  it('shows labor cost preview as $0.00 when all zeros', () => {
    renderStep3();

    const preview = screen.getByTestId('labor-cost-preview');
    expect(preview).toHaveTextContent('$0.00');
  });

  it('updates labor cost preview when hourly rate changes', () => {
    renderStep3({ batchTimeHours: 2 });

    const hourlyRateInput = screen.getByLabelText(/Hourly rate/) as HTMLInputElement;
    fireEvent.change(hourlyRateInput, { target: { value: '15' } });

    const preview = screen.getByTestId('labor-cost-preview');
    expect(preview).toHaveTextContent('$30.00');
  });

  it('updates labor cost preview when labor time changes', () => {
    renderStep3({ batchTimeHours: 2 });

    const hourlyRateInput = screen.getByLabelText(/Hourly rate/) as HTMLInputElement;
    fireEvent.change(hourlyRateInput, { target: { value: '20' } });

    const laborTimeInput = screen.getByLabelText(/Labor time/) as HTMLInputElement;
    fireEvent.change(laborTimeInput, { target: { value: '3' } });

    const preview = screen.getByTestId('labor-cost-preview');
    expect(preview).toHaveTextContent('$60.00');
  });

  // --- Default values and editability ---

  it('defaults all cost fields to 0 for free users', () => {
    renderStep3();

    expect((screen.getByLabelText(/Hourly rate/) as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText(/Packaging/) as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText(/Overhead/) as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText(/Platform fees/) as HTMLInputElement).value).toBe('0');
  });

  it('allows editing labor time (overriding pre-filled value)', () => {
    renderStep3({ batchTimeHours: 2 });

    const laborTimeInput = screen.getByLabelText(/Labor time/) as HTMLInputElement;
    fireEvent.change(laborTimeInput, { target: { value: '5' } });

    expect(laborTimeInput.value).toBe('5');
  });

  // --- Validation ---

  it('shows inline error for negative hourly rate after blur', () => {
    renderStep3();

    const hourlyRateInput = screen.getByLabelText(/Hourly rate/);
    fireEvent.change(hourlyRateInput, { target: { value: '-5' } });
    fireEvent.blur(hourlyRateInput);

    expect(screen.getByText('Must be 0 or greater')).toBeInTheDocument();
  });

  it('shows inline error for negative labor time after blur', () => {
    renderStep3();

    const laborTimeInput = screen.getByLabelText(/Labor time/);
    fireEvent.change(laborTimeInput, { target: { value: '-1' } });
    fireEvent.blur(laborTimeInput);

    expect(screen.getByText('Must be 0 or greater')).toBeInTheDocument();
  });

  it('shows inline error for negative packaging after blur', () => {
    renderStep3();

    const packagingInput = screen.getByLabelText(/Packaging/);
    fireEvent.change(packagingInput, { target: { value: '-2' } });
    fireEvent.blur(packagingInput);

    expect(screen.getByText('Must be 0 or greater')).toBeInTheDocument();
  });

  it('does not show error before field is touched', () => {
    renderStep3();

    const hourlyRateInput = screen.getByLabelText(/Hourly rate/);
    fireEvent.change(hourlyRateInput, { target: { value: '-5' } });

    // Error should NOT appear yet (field not blurred)
    const errorElements = screen.queryAllByText('Must be 0 or greater');
    expect(errorElements).toHaveLength(0);
  });

  // --- onValidChange callback ---

  it('calls onValidChange(true) when all fields are valid (all zeros)', () => {
    const onValidChange = vi.fn();
    renderStep3({}, vi.fn(), onValidChange);

    // On initial render, all fields are 0 -> valid
    expect(onValidChange).toHaveBeenCalledWith(true);
  });

  it('calls onValidChange(false) when a field is negative', () => {
    const onValidChange = vi.fn();
    renderStep3({}, vi.fn(), onValidChange);

    const hourlyRateInput = screen.getByLabelText(/Hourly rate/);
    fireEvent.change(hourlyRateInput, { target: { value: '-5' } });

    expect(onValidChange).toHaveBeenCalledWith(false);
  });

  // --- onUpdate callback ---

  it('calls onUpdate with correct values when hourly rate changes', () => {
    const onUpdate = vi.fn();
    renderStep3({}, onUpdate);

    const hourlyRateInput = screen.getByLabelText(/Hourly rate/);
    fireEvent.change(hourlyRateInput, { target: { value: '20' } });

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ hourlyRate: 20 }),
    );
  });

  // --- Pre-filled from laborAndOverhead ---

  it('pre-fills fields from existing laborAndOverhead values', () => {
    renderStep3({
      laborAndOverhead: {
        hourlyRate: 18,
        packaging: 3,
        overhead: 5,
        platformFees: 2,
      },
    });

    expect((screen.getByLabelText(/Hourly rate/) as HTMLInputElement).value).toBe('18');
    expect((screen.getByLabelText(/Packaging/) as HTMLInputElement).value).toBe('3');
    expect((screen.getByLabelText(/Overhead/) as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText(/Platform fees/) as HTMLInputElement).value).toBe('2');
  });

  // --- Platform fees label hint ---

  it('shows platform fees description hint', () => {
    renderStep3();

    expect(
      screen.getByText('Fixed platform or delivery fees'),
    ).toBeInTheDocument();
  });

  // --- UserDefaults pre-fill for paid users ---

  describe('UserDefaults pre-fill (paid users)', () => {
    it('pre-fills fields from defaults when user is paid and recipe fields are all zero', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      renderStep3();

      expect((screen.getByLabelText(/Hourly rate/) as HTMLInputElement).value).toBe('20');
      expect((screen.getByLabelText(/Packaging/) as HTMLInputElement).value).toBe('5');
      expect((screen.getByLabelText(/Overhead/) as HTMLInputElement).value).toBe('10');
      expect((screen.getByLabelText(/Platform fees/) as HTMLInputElement).value).toBe('3');
    });

    it('shows "Using your defaults" hint when defaults are active', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      renderStep3();

      expect(screen.getByTestId('defaults-hint')).toBeInTheDocument();
      expect(screen.getByText(/Using your defaults/)).toBeInTheDocument();
    });

    it('does not show defaults hint for free users even with defaults set', () => {
      mockIsUnlocked = false;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      renderStep3();

      expect(screen.queryByTestId('defaults-hint')).not.toBeInTheDocument();
      // Should use recipe values (all zero), not defaults
      expect((screen.getByLabelText(/Hourly rate/) as HTMLInputElement).value).toBe('0');
    });

    it('does not show defaults hint when defaults are all zero', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 0,
        packaging: 0,
        overhead: 0,
        platformFees: 0,
      };

      renderStep3();

      expect(screen.queryByTestId('defaults-hint')).not.toBeInTheDocument();
    });

    it('does not pre-fill from defaults when recipe already has non-zero values', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      renderStep3({
        laborAndOverhead: {
          hourlyRate: 18,
          packaging: 4,
          overhead: 8,
          platformFees: 2,
        },
      });

      // Should use recipe values, not defaults
      expect((screen.getByLabelText(/Hourly rate/) as HTMLInputElement).value).toBe('18');
      expect((screen.getByLabelText(/Packaging/) as HTMLInputElement).value).toBe('4');
      expect((screen.getByLabelText(/Overhead/) as HTMLInputElement).value).toBe('8');
      expect((screen.getByLabelText(/Platform fees/) as HTMLInputElement).value).toBe('2');
      expect(screen.queryByTestId('defaults-hint')).not.toBeInTheDocument();
    });

    it('dismisses defaults hint when user changes a field', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      renderStep3();

      expect(screen.getByTestId('defaults-hint')).toBeInTheDocument();

      // Edit hourly rate to override
      const hourlyRateInput = screen.getByLabelText(/Hourly rate/);
      fireEvent.change(hourlyRateInput, { target: { value: '25' } });

      // Hint should disappear
      expect(screen.queryByTestId('defaults-hint')).not.toBeInTheDocument();
    });

    it('calls onUpdate with default values when pre-filled', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      const onUpdate = vi.fn();
      renderStep3({}, onUpdate);

      // Should call onUpdate with pre-filled default values
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          hourlyRate: 20,
          packaging: 5,
          overhead: 10,
          platformFees: 3,
        }),
      );
    });

    it('allows overriding default values without affecting globals', () => {
      mockIsUnlocked = true;
      mockDefaults = {
        hourlyRate: 20,
        packaging: 5,
        overhead: 10,
        platformFees: 3,
      };

      const onUpdate = vi.fn();
      renderStep3({}, onUpdate);

      // Override hourly rate
      const hourlyRateInput = screen.getByLabelText(/Hourly rate/);
      fireEvent.change(hourlyRateInput, { target: { value: '25' } });

      // onUpdate should be called with the overridden value
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ hourlyRate: 25 }),
      );

      // Defaults should remain unchanged (they are not mutated)
      expect(mockDefaults.hourlyRate).toBe(20);
    });
  });
});
