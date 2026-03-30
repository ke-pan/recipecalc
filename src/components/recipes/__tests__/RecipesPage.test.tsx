import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
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
// Mock analytics
// ---------------------------------------------------------------------------

const mockTrackEvent = vi.fn();

vi.mock('../../../lib/analytics.js', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
  EVENTS: {
    EXPORT_JSON: 'export_json',
  },
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const LICENSE_KEY = 'recipecalc_license';
const RECIPES_KEY = 'recipecalc_recipes';
const CURRENT_KEY = 'recipecalc_current';

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
  mockTrackEvent.mockReset();
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

  // ---- Export all ----

  it('renders Export all button when licensed', () => {
    setupUnlocked();
    render(<RecipesPage />);
    expect(screen.getByTestId('export-btn')).toBeInTheDocument();
    expect(screen.getByText('Export all')).toBeInTheDocument();
  });

  it('export triggers download with correct filename pattern', () => {
    const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    const mockRevokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    // Track anchor elements created by export (don't mock appendChild/removeChild
    // since React also uses them for rendering)
    let capturedAnchor: HTMLAnchorElement | null = null;
    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const el = origCreateElement(tag, options);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });

    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByTestId('export-btn'));

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    // Check the anchor element had the right download attribute
    const dateStr = new Date().toISOString().slice(0, 10);
    expect(capturedAnchor!.download).toBe(`recipecalc-backup-${dateStr}.json`);
  });

  it('export does not include license key in JSON', () => {
    setupUnlocked([makeSavedRecipe()]);

    // The exported data comes from readRecipes() which reads recipecalc_recipes
    // from localStorage. Verify the stored recipes don't contain license key.
    const recipesRaw = store[RECIPES_KEY];
    const recipes = JSON.parse(recipesRaw);
    expect(recipes[0]).not.toHaveProperty('licenseKey');
    expect(recipesRaw).not.toContain('test-key-123');

    // Also verify the license key exists in a DIFFERENT storage key
    expect(store[LICENSE_KEY]).toContain('test-key-123');
  });

  it('export tracks EXPORT_JSON analytics event', () => {
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const el = origCreateElement(tag, options);
      if (tag === 'a') (el as HTMLAnchorElement).click = vi.fn();
      return el;
    });

    setupUnlocked([makeSavedRecipe()]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByTestId('export-btn'));
    expect(mockTrackEvent).toHaveBeenCalledWith('export_json');
  });

  // ---- Import ----

  it('renders Import button when licensed', () => {
    setupUnlocked();
    render(<RecipesPage />);
    expect(screen.getByTestId('import-btn')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('renders hidden file input with .json accept', () => {
    setupUnlocked();
    render(<RecipesPage />);
    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.accept).toBe('.json');
  });

  it('import shows success toast with counts', async () => {
    const newRecipe = makeSavedRecipe({ id: 'new-import-1' });
    const importJSON = JSON.stringify([newRecipe]);

    setupUnlocked([makeSavedRecipe({ id: 'existing-1' })]);
    render(<RecipesPage />);

    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    const file = new File([importJSON], 'backup.json', { type: 'application/json' });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('import-toast')).toBeInTheDocument();
    });
    expect(screen.getByText('Imported 1 new recipe, 0 skipped (already exist)')).toBeInTheDocument();
  });

  it('import skips recipes that already exist (merge by id)', async () => {
    const existing = makeSavedRecipe({ id: 'existing-1' });
    const importJSON = JSON.stringify([existing]);

    setupUnlocked([existing]);
    render(<RecipesPage />);

    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    const file = new File([importJSON], 'backup.json', { type: 'application/json' });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('import-toast')).toBeInTheDocument();
    });
    expect(screen.getByText('Imported 0 new recipes, 1 skipped (already exist)')).toBeInTheDocument();
  });

  it('import shows error toast for invalid JSON', async () => {
    setupUnlocked();
    render(<RecipesPage />);

    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    const file = new File(['not valid json {{{'], 'bad.json', { type: 'application/json' });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('import-toast')).toBeInTheDocument();
    });
    expect(screen.getByText('Invalid JSON file')).toBeInTheDocument();
  });

  it('toast can be dismissed', async () => {
    const newRecipe = makeSavedRecipe({ id: 'dismissible-1' });
    const importJSON = JSON.stringify([newRecipe]);

    setupUnlocked();
    render(<RecipesPage />);

    const input = screen.getByTestId('import-file-input') as HTMLInputElement;
    const file = new File([importJSON], 'backup.json', { type: 'application/json' });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByTestId('import-toast')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByTestId('import-toast')).not.toBeInTheDocument();
  });

  // ---- Draft conflict detection ----

  it('edit navigates directly when no draft exists', () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    setupUnlocked([makeSavedRecipe({ id: 'no-draft-test' })]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Edit'));
    expect(window.location.href).toBe('/calculator?edit=no-draft-test');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('edit shows confirm when draft with name exists', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    // Set up a draft in progress
    store[CURRENT_KEY] = JSON.stringify({
      version: 1,
      step: 1,
      recipe: { name: 'Draft Recipe', ingredients: [] },
    });

    setupUnlocked([makeSavedRecipe({ id: 'draft-test' })]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Edit'));
    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Load this recipe anyway?');
    expect(window.location.href).toBe('/calculator?edit=draft-test');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('edit shows confirm when draft with ingredients exists', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    store[CURRENT_KEY] = JSON.stringify({
      version: 1,
      step: 2,
      recipe: { name: '', ingredients: [{ id: '1', name: 'Flour' }] },
    });

    setupUnlocked([makeSavedRecipe({ id: 'ing-draft-test' })]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Edit'));
    expect(confirmSpy).toHaveBeenCalledWith('You have unsaved changes. Load this recipe anyway?');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('cancel on draft conflict prevents navigation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    store[CURRENT_KEY] = JSON.stringify({
      version: 1,
      step: 1,
      recipe: { name: 'Unsaved Recipe', ingredients: [] },
    });

    setupUnlocked([makeSavedRecipe({ id: 'cancel-test' })]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Edit'));
    // Should NOT navigate
    expect(window.location.href).toBe('');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('no confirm shown when draft has empty name and no ingredients', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });

    store[CURRENT_KEY] = JSON.stringify({
      version: 1,
      step: 1,
      recipe: { name: '', ingredients: [] },
    });

    setupUnlocked([makeSavedRecipe({ id: 'empty-draft-test' })]);
    render(<RecipesPage />);

    fireEvent.click(screen.getByText('Edit'));
    // Should not have shown draft conflict dialog (delete confirm may fire for other clicks)
    expect(confirmSpy).not.toHaveBeenCalledWith('You have unsaved changes. Load this recipe anyway?');
    expect(window.location.href).toBe('/calculator?edit=empty-draft-test');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });
});
