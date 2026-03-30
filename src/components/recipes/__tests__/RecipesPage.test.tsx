import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecipesPage from '../RecipesPage';
import type { Recipe } from '../../../lib/calc/types.js';

// ---------------------------------------------------------------------------
// Mock LemonSqueezy API
// ---------------------------------------------------------------------------

const mockActivate = vi.fn();
const mockValidate = vi.fn();

vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: (...args: unknown[]) => mockActivate(...args),
  validateLicense: (...args: unknown[]) => mockValidate(...args),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const LICENSE_KEY = 'recipecalc_license';
const RECIPES_KEY = 'recipecalc_recipes';

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLicenseJSON(): string {
  return JSON.stringify({
    key: 'test-key-123',
    instanceId: 'instance-abc',
    activatedAt: '2026-03-30T12:00:00.000Z',
    storeId: '12345',
    productId: '67890',
  });
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    name: 'Chocolate Chip Cookies',
    quantity: 24,
    quantityUnit: 'cookies',
    batchTimeHours: 2,
    ingredients: [
      {
        id: 'ing-1',
        name: 'Flour',
        purchaseAmount: 5,
        purchaseUnit: 'lb',
        purchasePrice: 4.99,
        usedAmount: 2,
        usedUnit: 'lb',
        wastePercent: 0,
      },
    ],
    laborAndOverhead: {
      hourlyRate: 15,
      packaging: 3,
      overhead: 2,
      platformFees: 1,
    },
    ...overrides,
  };
}

function makeSavedRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: 'recipe-1',
    version: 1,
    savedAt: '2026-03-28T10:00:00.000Z',
    updatedAt: '2026-03-28T10:00:00.000Z',
    recipe: makeRecipe(),
    targetCostRatio: 0.3,
    ...overrides,
  };
}

function setupUnlocked(recipes: ReturnType<typeof makeSavedRecipe>[] = []) {
  store[LICENSE_KEY] = makeLicenseJSON();
  if (recipes.length > 0) {
    store[RECIPES_KEY] = JSON.stringify(recipes);
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  store = {};
  mockActivate.mockReset();
  mockValidate.mockReset();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true,
  });
  mockLocalStorage.getItem.mockImplementation((key: string) => store[key] ?? null);
  mockLocalStorage.setItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
  });
  mockLocalStorage.removeItem.mockImplementation((key: string) => {
    delete store[key];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecipesPage', () => {
  // ---- Navigation ----

  it('renders RecipeCalc logo linking to home', () => {
    setupUnlocked();
    render(<RecipesPage />);
    const logo = screen.getByText('RecipeCalc');
    expect(logo).toBeInTheDocument();
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('renders Calculator nav link', () => {
    setupUnlocked();
    render(<RecipesPage />);
    const link = screen.getByText('Calculator');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/calculator');
  });

  // ---- Paywall gate (unlicensed) ----

  it('shows paywall gate when user is not licensed', () => {
    render(<RecipesPage />);
    expect(screen.getByTestId('paywall-gate')).toBeInTheDocument();
    expect(screen.getByText('Recipe management is a paid feature')).toBeInTheDocument();
  });

  it('paywall gate links to /activate', () => {
    render(<RecipesPage />);
    const link = screen.getByText(/Activate license/);
    expect(link.closest('a')).toHaveAttribute('href', '/activate');
  });

  it('does not show recipes when unlicensed', () => {
    render(<RecipesPage />);
    expect(screen.queryByText('My Recipes')).not.toBeInTheDocument();
  });

  // ---- Empty state (licensed, no recipes) ----

  it('shows empty state when licensed but no recipes saved', () => {
    setupUnlocked();
    render(<RecipesPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No recipes yet')).toBeInTheDocument();
    expect(screen.getByText('Calculate your first recipe to see it here.')).toBeInTheDocument();
  });

  it('empty state links to /calculator', () => {
    setupUnlocked();
    render(<RecipesPage />);
    const link = screen.getByRole('link', { name: /Calculate your first recipe/ });
    expect(link).toHaveAttribute('href', '/calculator');
  });

  it('shows "0 recipes" count when empty', () => {
    setupUnlocked();
    render(<RecipesPage />);
    expect(screen.getByText('0 recipes')).toBeInTheDocument();
  });

  // ---- Recipe cards (licensed, with recipes) ----

  it('renders recipe cards when recipes exist', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    expect(screen.getByTestId('recipe-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-card')).toHaveLength(1);
  });

  it('displays recipe name', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  });

  it('displays yield (quantity + unit)', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    expect(screen.getByText('24 cookies')).toBeInTheDocument();
  });

  it('displays save date', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    // Date rendering is locale-dependent, just verify it renders something
    const dateStr = new Date('2026-03-28T10:00:00.000Z').toLocaleDateString();
    expect(screen.getByText(dateStr)).toBeInTheDocument();
  });

  it('displays real-time calculated true total cost', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    // The recipe has: flour $4.99 * (2/5) = $2.00, labor = 2*15 = $30, packaging = $3, overhead = $2, platform = $1
    // True total = $2.00 + $30.00 + $3.00 + $2.00 + $1.00 = $38.00
    expect(screen.getByText('$38.00')).toBeInTheDocument();
  });

  it('displays real-time calculated recommended price per unit', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    // costPerUnit = $38.00 / 24 = $1.58, recommendedPricePerUnit = $1.58 / 0.3 = $5.27
    expect(screen.getByText(/\$5\.27/)).toBeInTheDocument();
  });

  it('displays correct count for multiple recipes', () => {
    setupUnlocked([
      makeSavedRecipe({ id: 'r1' }),
      makeSavedRecipe({ id: 'r2', recipe: makeRecipe({ name: 'Banana Bread' }) }),
    ]);
    render(<RecipesPage />);
    expect(screen.getByText('2 recipes')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-card')).toHaveLength(2);
  });

  it('shows singular "recipe" for count of 1', () => {
    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);
    expect(screen.getByText('1 recipe')).toBeInTheDocument();
  });

  // ---- Edit button ----

  it('edit button navigates to /calculator?edit=<id>', () => {
    // Mock window.location
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    setupUnlocked([makeSavedRecipe({ id: 'abc-123' })]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Edit'));
    expect(window.location.href).toBe('/calculator?edit=abc-123');

    // Restore
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  // ---- Delete with confirmation ----

  it('delete button shows confirm dialog', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Delete'));
    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete "Chocolate Chip Cookies"? This cannot be undone.',
    );
  });

  it('removes recipe when delete is confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);

    expect(screen.getAllByTestId('recipe-card')).toHaveLength(1);
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.queryByTestId('recipe-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('does not remove recipe when delete is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getAllByTestId('recipe-card')).toHaveLength(1);
  });

  // ---- Re-validate license ----

  it('renders re-validate button', () => {
    setupUnlocked();
    render(<RecipesPage />);
    expect(screen.getByTestId('revalidate-btn')).toBeInTheDocument();
    expect(screen.getByText('Re-validate license')).toBeInTheDocument();
  });

  it('shows "Checking..." during revalidation', async () => {
    let resolveValidate: (value: unknown) => void;
    mockValidate.mockReturnValue(new Promise((resolve) => { resolveValidate = resolve; }));

    setupUnlocked();
    const user = userEvent.setup();
    render(<RecipesPage />);

    await user.click(screen.getByTestId('revalidate-btn'));
    expect(screen.getByText('Checking...')).toBeInTheDocument();
    expect(screen.getByTestId('revalidate-btn')).toBeDisabled();

    // Cleanup
    resolveValidate!({ ok: true });
  });

  it('shows success message after valid revalidation', async () => {
    mockValidate.mockResolvedValueOnce({ ok: true });

    setupUnlocked();
    const user = userEvent.setup();
    render(<RecipesPage />);

    await user.click(screen.getByTestId('revalidate-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('revalidate-success')).toBeInTheDocument();
    });
    expect(screen.getByText('License valid')).toBeInTheDocument();
  });

  it('shows failed message after invalid revalidation', async () => {
    mockValidate.mockResolvedValueOnce({ ok: false, reason: 'invalid' });

    setupUnlocked();
    const user = userEvent.setup();
    render(<RecipesPage />);

    await user.click(screen.getByTestId('revalidate-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('revalidate-failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Validation failed')).toBeInTheDocument();
  });

  it('calls validateLicense with correct key and instanceId', async () => {
    mockValidate.mockResolvedValueOnce({ ok: true });

    setupUnlocked();
    const user = userEvent.setup();
    render(<RecipesPage />);

    await user.click(screen.getByTestId('revalidate-btn'));

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledWith('test-key-123', 'instance-abc');
    });
  });
});
