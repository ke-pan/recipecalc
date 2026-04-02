import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PantryPage from '../PantryPage';

// ---------------------------------------------------------------------------
// Mock LemonSqueezy service (needed by LicenseContext)
// ---------------------------------------------------------------------------

vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: vi.fn(),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// ---------------------------------------------------------------------------
// Mock useRecipes (needed by usePantry.getReferencingRecipeCount)
// ---------------------------------------------------------------------------

const mockReadRecipes = vi.fn().mockReturnValue([]);

vi.mock('../../../hooks/useRecipes.js', () => ({
  readRecipes: () => mockReadRecipes(),
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

const LICENSE_KEY = 'recipecalc_license';
const PANTRY_KEY = 'recipecalc_pantry';

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

function makePantryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    name: 'All-Purpose Flour',
    ingredientKey: 'all-purpose-flour',
    purchaseUnit: 'lb',
    purchaseAmount: 5,
    purchasePrice: 4.99,
    updatedAt: '2026-03-30T12:00:00.000Z',
    ...overrides,
  };
}

function setupWithLicense(pantryItems: unknown[] = []) {
  store[LICENSE_KEY] = makeLicenseJSON();
  if (pantryItems.length > 0) {
    store[PANTRY_KEY] = JSON.stringify(pantryItems);
  }
}

// ---------------------------------------------------------------------------
// Mock window.location
// ---------------------------------------------------------------------------

const originalLocation = window.location;

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  store = {};
  mockReadRecipes.mockReturnValue([]);

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

  // Mock crypto.randomUUID
  let counter = 0;
  vi.stubGlobal('crypto', {
    randomUUID: () => `mock-uuid-${++counter}`,
  });

  // Mock window.location for redirect testing
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...originalLocation, href: '' },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: originalLocation,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PantryPage', () => {
  // ---- License gating ----

  it('redirects to /activate when user is not licensed', () => {
    render(<PantryPage />);
    expect(window.location.href).toBe('/activate');
  });

  it('renders pantry page when user is licensed', () => {
    setupWithLicense();
    render(<PantryPage />);
    expect(screen.getByText('Your Pantry')).toBeInTheDocument();
  });

  // ---- Empty state ----

  it('shows empty state when no ingredients exist', () => {
    setupWithLicense();
    render(<PantryPage />);
    expect(screen.getByTestId('pantry-empty')).toBeInTheDocument();
    expect(screen.getByText(/No ingredients yet/)).toBeInTheDocument();
  });

  // ---- Displaying ingredients ----

  it('renders ingredients in a table', () => {
    setupWithLicense([makePantryItem()]);
    render(<PantryPage />);
    expect(screen.getByTestId('pantry-table')).toBeInTheDocument();
    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
  });

  it('shows unit price calculated from price / amount', () => {
    setupWithLicense([makePantryItem({ id: 'flour-1', purchasePrice: 5, purchaseAmount: 5 })]);
    render(<PantryPage />);
    // $5.00 / 5 lb = $1.00/lb
    expect(screen.getByTestId('unit-price-flour-1')).toHaveTextContent('$1.00/lb');
  });

  // ---- Adding ingredients ----

  it('adds a new ingredient via the add row', async () => {
    setupWithLicense();
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.type(screen.getByTestId('add-name-input'), 'Brown Sugar');
    await user.clear(screen.getByTestId('add-amount-input'));
    await user.type(screen.getByTestId('add-amount-input'), '2');
    await user.type(screen.getByTestId('add-price-input'), '3.49');
    await user.click(screen.getByTestId('add-ingredient-btn'));

    expect(screen.getByText('Brown Sugar')).toBeInTheDocument();
    expect(screen.queryByTestId('pantry-empty')).not.toBeInTheDocument();
  });

  it('shows error when adding duplicate ingredient name', async () => {
    setupWithLicense([makePantryItem({ name: 'Brown Sugar' })]);
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.type(screen.getByTestId('add-name-input'), 'Brown Sugar');
    await user.clear(screen.getByTestId('add-amount-input'));
    await user.type(screen.getByTestId('add-amount-input'), '1');
    await user.type(screen.getByTestId('add-price-input'), '2');
    await user.click(screen.getByTestId('add-ingredient-btn'));

    expect(screen.getByTestId('pantry-error')).toBeInTheDocument();
    expect(screen.getByText(/already exists/)).toBeInTheDocument();
  });

  it('shows error when adding with empty name', async () => {
    setupWithLicense();
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.click(screen.getByTestId('add-ingredient-btn'));

    expect(screen.getByTestId('pantry-error')).toBeInTheDocument();
    expect(screen.getByText(/name is required/)).toBeInTheDocument();
  });

  it('clears add form after successful add', async () => {
    setupWithLicense();
    const user = userEvent.setup();
    render(<PantryPage />);

    const nameInput = screen.getByTestId('add-name-input');
    await user.type(nameInput, 'Vanilla Extract');
    await user.clear(screen.getByTestId('add-amount-input'));
    await user.type(screen.getByTestId('add-amount-input'), '1');
    await user.type(screen.getByTestId('add-price-input'), '8.99');
    await user.click(screen.getByTestId('add-ingredient-btn'));

    expect(nameInput).toHaveValue('');
  });

  // ---- Inline editing ----

  it('allows inline editing of ingredient name', async () => {
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    const nameCell = screen.getByTestId('name-item-1');
    await user.click(nameCell);

    // Should now be an input
    const input = screen.getByLabelText('Name: All-Purpose Flour');
    expect(input).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'Bread Flour{Enter}');

    // Should update
    await waitFor(() => {
      expect(screen.getByText('Bread Flour')).toBeInTheDocument();
    });
  });

  it('allows inline editing of purchase price', async () => {
    setupWithLicense([makePantryItem({ id: 'edit-price-1', purchasePrice: 4.99 })]);
    const user = userEvent.setup();
    render(<PantryPage />);

    const priceCell = screen.getByTestId('price-edit-price-1');
    await user.click(priceCell);

    const input = screen.getByLabelText('Price: 4.99');
    await user.clear(input);
    await user.type(input, '6.99{Enter}');

    // Unit price should recalculate: $6.99 / 5 = $1.40/lb
    await waitFor(() => {
      expect(screen.getByTestId('unit-price-edit-price-1')).toHaveTextContent('$1.40/lb');
    });
  });

  it('reverts edit on Escape', async () => {
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    const nameCell = screen.getByTestId('name-item-1');
    await user.click(nameCell);

    const input = screen.getByLabelText('Name: All-Purpose Flour');
    await user.clear(input);
    await user.type(input, 'Something Else{Escape}');

    // Should revert to original
    await waitFor(() => {
      expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
    });
  });

  // ---- Unit dropdown ----

  it('allows changing unit via dropdown', async () => {
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    const dropdown = screen.getByLabelText('Unit for All-Purpose Flour');
    await user.selectOptions(dropdown, 'kg');

    // Should update the unit price label
    await waitFor(() => {
      expect(screen.getByTestId('unit-price-item-1')).toHaveTextContent('/kg');
    });
  });

  // ---- Deleting ingredients ----

  it('deletes ingredient without confirmation when no references', async () => {
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();

    await user.click(screen.getByTestId('delete-item-1'));

    // Should be removed immediately (no dialog)
    expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('All-Purpose Flour')).not.toBeInTheDocument();
  });

  it('shows confirmation dialog when deleting ingredient with references', async () => {
    mockReadRecipes.mockReturnValue([
      {
        id: 'recipe-1',
        recipe: {
          ingredients: [{ pantryId: 'item-1', name: 'Flour' }],
        },
      },
    ]);
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.click(screen.getByTestId('delete-item-1'));

    expect(screen.getByTestId('delete-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/used in 1 recipe/)).toBeInTheDocument();
  });

  it('deletes ingredient after confirmation', async () => {
    mockReadRecipes.mockReturnValue([
      {
        id: 'recipe-1',
        recipe: {
          ingredients: [{ pantryId: 'item-1', name: 'Flour' }],
        },
      },
    ]);
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.click(screen.getByTestId('delete-item-1'));
    await user.click(screen.getByTestId('confirm-delete'));

    expect(screen.queryByText('All-Purpose Flour')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument();
  });

  it('cancels delete dialog', async () => {
    mockReadRecipes.mockReturnValue([
      {
        id: 'recipe-1',
        recipe: {
          ingredients: [{ pantryId: 'item-1', name: 'Flour' }],
        },
      },
    ]);
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.click(screen.getByTestId('delete-item-1'));
    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByTestId('delete-confirm-dialog')).not.toBeInTheDocument();
    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
  });

  // ---- Search/filter ----

  it('filters ingredients by search query', async () => {
    setupWithLicense([
      makePantryItem({ id: 'flour', name: 'All-Purpose Flour' }),
      makePantryItem({ id: 'sugar', name: 'Brown Sugar' }),
    ]);
    const user = userEvent.setup();
    render(<PantryPage />);

    const searchInput = screen.getByTestId('pantry-search');
    await user.type(searchInput, 'flour');

    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
    expect(screen.queryByText('Brown Sugar')).not.toBeInTheDocument();
  });

  it('shows no results message when search matches nothing', async () => {
    setupWithLicense([makePantryItem()]);
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.type(screen.getByTestId('pantry-search'), 'xyz');

    expect(screen.getByTestId('pantry-no-results')).toBeInTheDocument();
    expect(screen.getByText(/No ingredients match/)).toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    setupWithLicense([makePantryItem({ name: 'All-Purpose Flour' })]);
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.type(screen.getByTestId('pantry-search'), 'FLOUR');

    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
  });

  // ---- Persistence ----

  it('saves new ingredient to localStorage', async () => {
    setupWithLicense();
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.type(screen.getByTestId('add-name-input'), 'Salt');
    await user.clear(screen.getByTestId('add-amount-input'));
    await user.type(screen.getByTestId('add-amount-input'), '1');
    await user.type(screen.getByTestId('add-price-input'), '1.99');
    await user.click(screen.getByTestId('add-ingredient-btn'));

    const stored = JSON.parse(store[PANTRY_KEY]);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Salt');
    expect(stored[0].purchasePrice).toBe(1.99);
  });

  // ---- Navigation ----

  it('has a logo linking to home', () => {
    setupWithLicense();
    render(<PantryPage />);
    const logo = screen.getByText('RecipeCalc');
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });

  it('has a link to the calculator', () => {
    setupWithLicense();
    render(<PantryPage />);
    const calcLink = screen.getByText('Calculator');
    expect(calcLink.closest('a')).toHaveAttribute('href', '/calculator');
  });

  // ---- Keyboard support ----

  it('supports adding ingredient via Enter key', async () => {
    setupWithLicense();
    const user = userEvent.setup();
    render(<PantryPage />);

    await user.type(screen.getByTestId('add-name-input'), 'Eggs');
    await user.clear(screen.getByTestId('add-amount-input'));
    await user.type(screen.getByTestId('add-amount-input'), '12');
    // Change unit to "each" by typing into price and pressing Enter
    await user.selectOptions(screen.getByTestId('add-unit-select'), 'each');
    await user.type(screen.getByTestId('add-price-input'), '3.49{Enter}');

    expect(screen.getByText('Eggs')).toBeInTheDocument();
  });
});
