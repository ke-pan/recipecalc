import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplatePage from '../TemplatePage';

// ---------------------------------------------------------------------------
// Mock LemonSqueezy API (required by LicenseProvider)
// ---------------------------------------------------------------------------

vi.mock('../../../services/lemonsqueezy.js', () => ({
  activateLicense: vi.fn(),
  _env: {
    get storeId() { return '12345'; },
    get productId() { return '67890'; },
  },
}));

// ---------------------------------------------------------------------------
// Mock analytics
// ---------------------------------------------------------------------------

vi.mock('../../../lib/analytics', () => ({
  trackEvent: vi.fn(),
  EVENTS: {},
}));

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

let store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
};

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

const LICENSE_KEY = 'recipecalc_license';
const RECIPES_KEY = 'recipecalc_recipes';
const PANTRY_KEY = 'recipecalc_pantry';

function makeLicenseJSON(): string {
  return JSON.stringify({
    key: 'test-key-123',
    instanceId: 'instance-abc',
    activatedAt: '2026-03-30T12:00:00.000Z',
    storeId: '12345',
    productId: '67890',
  });
}

function makeRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'recipe-1',
    version: 1,
    savedAt: '2026-03-30T12:00:00.000Z',
    updatedAt: '2026-03-30T12:00:00.000Z',
    targetCostRatio: 0.3,
    recipe: {
      name: (overrides.name as string) ?? 'Chocolate Cookies',
      quantity: 24,
      quantityUnit: 'cookies',
      batchTimeHours: 2,
      ingredients: [
        {
          id: 'ing-1',
          name: 'All-Purpose Flour',
          purchaseAmount: 5,
          purchaseUnit: 'lb',
          purchasePrice: 4.99,
          usedAmount: 2,
          usedUnit: 'lb',
          wastePercent: 5,
          pantryId: null,
        },
        {
          id: 'ing-2',
          name: 'Sugar',
          purchaseAmount: 4,
          purchaseUnit: 'lb',
          purchasePrice: 3.49,
          usedAmount: 1,
          usedUnit: 'lb',
          wastePercent: 0,
          pantryId: null,
        },
      ],
      laborAndOverhead: {
        hourlyRate: 15,
        packaging: 5,
        overhead: 3,
        platformFees: 2,
      },
      ...overrides.recipe as object,
    },
    ...overrides,
  };
}

function makePantryItem(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'pantry-1',
    name: (overrides.name as string) ?? 'All-Purpose Flour',
    ingredientKey: 'all-purpose-flour',
    purchaseUnit: 'lb',
    purchaseAmount: 5,
    purchasePrice: 4.99,
    updatedAt: '2026-03-30T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock window.location
// ---------------------------------------------------------------------------

const originalLocation = window.location;
let mockLocationHref = '';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  store = {};
  mockLocationHref = '';

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

  // Mock window.location for redirect detection
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: {
      ...originalLocation,
      get href() { return mockLocationHref; },
      set href(val: string) { mockLocationHref = val; },
    },
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

describe('TemplatePage', () => {
  // ---- License gating ----

  it('redirects to /activate when user is not unlocked', () => {
    render(<TemplatePage />);
    expect(mockLocationHref).toBe('/activate');
  });

  it('renders page content when user is unlocked', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<TemplatePage />);
    expect(screen.getByText('Recipes')).toBeInTheDocument();
  });

  // ---- Empty state ----

  it('shows empty state when no recipes exist', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<TemplatePage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No recipes yet.')).toBeInTheDocument();
    expect(screen.getByText(/Create your first recipe/)).toBeInTheDocument();
  });

  it('empty state links to /calculator', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<TemplatePage />);
    const link = screen.getByText(/Create your first recipe/);
    expect(link.closest('a')).toHaveAttribute('href', '/calculator');
  });

  // ---- Recipe table ----

  it('displays recipe table with correct column headers', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    expect(screen.getByText('Recipe')).toBeInTheDocument();
    expect(screen.getByText('Yield')).toBeInTheDocument();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(screen.getByText('Labor')).toBeInTheDocument();
    expect(screen.getByText('Total Cost')).toBeInTheDocument();
    expect(screen.getByText('Rec. Price')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('displays recipe name, yield, and computed costs', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    expect(screen.getByText('Chocolate Cookies')).toBeInTheDocument();
    expect(screen.getByText(/24 cookies/)).toBeInTheDocument();
  });

  it('shows recipe count in toolbar', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    expect(screen.getByTestId('recipe-count')).toHaveTextContent('1 recipe');
  });

  it('pluralizes recipe count correctly', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([
      makeRecipe({ id: 'r1', name: 'Cookie A' }),
      makeRecipe({ id: 'r2', name: 'Cookie B' }),
    ]);
    render(<TemplatePage />);

    expect(screen.getByTestId('recipe-count')).toHaveTextContent('2 recipes');
  });

  // ---- Computed costs ----

  it('computes and displays monetary values using Geist Mono', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    // Ingredient cost: flour = 4.99*(2/5)*1.05 = 2.09; sugar = 3.49*(1/4)*1.0 = 0.87
    // Total ingredient cost = $2.96 (rounded)
    // Should have mono class for tabular numbers
    const monoCells = document.querySelectorAll('.mono');
    expect(monoCells.length).toBeGreaterThan(0);
  });

  it('shows recommended price in confidence color', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    const priceCell = document.querySelector('.template__confidence');
    expect(priceCell).toBeInTheDocument();
    expect(priceCell?.textContent).toContain('/ea');
  });

  // ---- Row expansion ----

  it('expands row to show ingredient details when clicking recipe name', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    // Click on recipe name to expand
    await user.click(screen.getByText('Chocolate Cookies'));

    // Ingredient table should appear
    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
    expect(screen.getByText('Sugar')).toBeInTheDocument();
  });

  it('collapses expanded row when clicking recipe name again', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    // Expand
    await user.click(screen.getByText('Chocolate Cookies'));
    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('Chocolate Cookies'));
    // Ingredient detail should be gone — the nested "All-Purpose Flour" was only in the expanded row
    const ingredientTable = document.querySelector('.template__ingredient-table');
    expect(ingredientTable).not.toBeInTheDocument();
  });

  it('expand button has correct aria-expanded attribute', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    const expandBtn = screen.getByRole('button', { name: /Expand Chocolate Cookies/ });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandBtn);
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows "Link" button for unlinked ingredients', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));

    // Both ingredients should have Link buttons
    const linkButtons = screen.getAllByText(/Link/);
    expect(linkButtons.length).toBe(2);
  });

  it('shows ingredient source as "Pantry" badge when linked to pantry item', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    const pantryItem = makePantryItem();
    store[PANTRY_KEY] = JSON.stringify([pantryItem]);

    const recipe = makeRecipe();
    recipe.recipe.ingredients[0].pantryId = pantryItem.id;
    store[RECIPES_KEY] = JSON.stringify([recipe]);

    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));

    expect(screen.getByText('Pantry')).toBeInTheDocument();
    // Sugar should have a Link button (not linked)
    expect(screen.getByLabelText('Link Sugar to Pantry')).toBeInTheDocument();
  });

  // ---- Edit button ----

  it('Edit button links to /calculator?edit=id', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe({ id: 'test-id-42' })]);
    render(<TemplatePage />);

    const editLink = screen.getByText('Edit');
    expect(editLink.closest('a')).toHaveAttribute('href', '/calculator?edit=test-id-42');
  });

  // ---- Delete flow ----

  it('shows delete confirmation dialog when Delete button is clicked', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    await user.click(screen.getByText('Delete'));

    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    expect(screen.getByText('Chocolate Cookies', { selector: 'strong' })).toBeInTheDocument();
  });

  it('cancels delete when Cancel is clicked', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    await user.click(screen.getByText('Delete'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    // Recipe should still be there
    expect(screen.getByText('Chocolate Cookies')).toBeInTheDocument();
  });

  it('deletes recipe when confirmed', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    await user.click(screen.getByText('Delete'));
    await user.click(screen.getByTestId('confirm-delete'));

    // Dialog should close
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
    // Recipe should be gone, empty state should show
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('delete dialog has role="alertdialog"', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    await user.click(screen.getByText('Delete'));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  // ---- Toolbar buttons ----

  it('renders Export and Import buttons', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);
    render(<TemplatePage />);

    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('renders "Go to Pantry" link', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<TemplatePage />);

    const pantryLink = screen.getByText('Go to Pantry');
    expect(pantryLink.closest('a')).toHaveAttribute('href', '/pantry');
  });

  // ---- Hydration warnings ----

  it('shows warning count when pantry item is deleted', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    // Recipe references a pantry item that doesn't exist
    const recipe = makeRecipe();
    recipe.recipe.ingredients[0].pantryId = 'deleted-pantry-id';
    store[RECIPES_KEY] = JSON.stringify([recipe]);
    store[PANTRY_KEY] = JSON.stringify([]); // pantry is empty

    render(<TemplatePage />);

    // Should show warning count badge on the row
    expect(screen.getByTitle('1 warning(s)')).toBeInTheDocument();
  });

  it('shows warning icon on ingredient with deleted pantry reference', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    const recipe = makeRecipe();
    recipe.recipe.ingredients[0].pantryId = 'deleted-pantry-id';
    store[RECIPES_KEY] = JSON.stringify([recipe]);
    store[PANTRY_KEY] = JSON.stringify([]);

    render(<TemplatePage />);

    // Expand the row
    await user.click(screen.getByText('Chocolate Cookies'));

    const warningIcon = screen.getByTitle('Pantry item deleted — using saved price');
    expect(warningIcon).toBeInTheDocument();
  });

  // ---- Pantry linking ----

  it('opens pantry dropdown when clicking Link button', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    const pantryItem = makePantryItem();
    store[PANTRY_KEY] = JSON.stringify([pantryItem]);
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);

    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));

    // Click the Link button for flour
    await user.click(screen.getByTestId('link-btn-ing-1'));

    // Dropdown should appear
    expect(screen.getByTestId('pantry-link-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Link to Pantry')).toBeInTheDocument();
    expect(screen.getByTestId(`pantry-option-${pantryItem.id}`)).toBeInTheDocument();
  });

  it('links ingredient to pantry item when selecting from dropdown', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    const pantryItem = makePantryItem();
    store[PANTRY_KEY] = JSON.stringify([pantryItem]);
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);

    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));
    await user.click(screen.getByTestId('link-btn-ing-1'));
    await user.click(screen.getByTestId(`pantry-option-${pantryItem.id}`));

    // Should now show "Pantry" badge instead of "Link" for flour
    expect(screen.getByText('Pantry')).toBeInTheDocument();

    // Verify localStorage was updated
    const savedRecipes = JSON.parse(store[RECIPES_KEY]);
    expect(savedRecipes[0].recipe.ingredients[0].pantryId).toBe(pantryItem.id);
    expect(savedRecipes[0].recipe.ingredients[0].ingredientKey).toBe(pantryItem.ingredientKey);
  });

  it('unlinks ingredient from pantry when clicking unlink button', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    const pantryItem = makePantryItem();
    store[PANTRY_KEY] = JSON.stringify([pantryItem]);

    const recipe = makeRecipe();
    recipe.recipe.ingredients[0].pantryId = pantryItem.id;
    recipe.recipe.ingredients[0].ingredientKey = pantryItem.ingredientKey;
    store[RECIPES_KEY] = JSON.stringify([recipe]);

    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));
    expect(screen.getByText('Pantry')).toBeInTheDocument();

    // Click unlink button
    await user.click(screen.getByLabelText('Unlink All-Purpose Flour from Pantry'));

    // Should now show Link button instead
    expect(screen.getByLabelText('Link All-Purpose Flour to Pantry')).toBeInTheDocument();

    // Verify localStorage was updated
    const savedRecipes = JSON.parse(store[RECIPES_KEY]);
    expect(savedRecipes[0].recipe.ingredients[0].pantryId).toBeNull();
  });

  it('shows empty dropdown message when no pantry items exist', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();
    store[PANTRY_KEY] = JSON.stringify([]);
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);

    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));
    await user.click(screen.getByTestId('link-btn-ing-1'));

    expect(screen.getByText(/No pantry items yet/)).toBeInTheDocument();
  });

  it('sorts pantry dropdown by name similarity', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    const pantryItems = [
      makePantryItem({ id: 'p-sugar', name: 'Sugar', ingredientKey: 'sugar' }),
      makePantryItem({ id: 'p-flour', name: 'All-Purpose Flour', ingredientKey: 'all-purpose-flour' }),
      makePantryItem({ id: 'p-butter', name: 'Butter', ingredientKey: 'butter' }),
    ];
    store[PANTRY_KEY] = JSON.stringify(pantryItems);
    store[RECIPES_KEY] = JSON.stringify([makeRecipe()]);

    render(<TemplatePage />);

    await user.click(screen.getByText('Chocolate Cookies'));
    // Click Link button for "All-Purpose Flour" ingredient
    await user.click(screen.getByTestId('link-btn-ing-1'));

    const dropdown = screen.getByTestId('pantry-link-dropdown');
    const options = within(dropdown).getAllByRole('option');

    // "All-Purpose Flour" should be first (exact match)
    expect(within(options[0]).getByText('All-Purpose Flour')).toBeInTheDocument();
  });

  it('linked ingredient cost reflects pantry pricing after hydration', async () => {
    const user = userEvent.setup();
    store[LICENSE_KEY] = makeLicenseJSON();

    // Pantry item with different pricing
    const pantryItem = makePantryItem({
      purchasePrice: 10.00, // Different from recipe's 4.99
      purchaseAmount: 10,   // Different from recipe's 5
    });
    store[PANTRY_KEY] = JSON.stringify([pantryItem]);

    const recipe = makeRecipe();
    recipe.recipe.ingredients[0].pantryId = pantryItem.id;
    store[RECIPES_KEY] = JSON.stringify([recipe]);

    render(<TemplatePage />);

    // The costs should be computed using pantry pricing via hydration
    // flour cost = 10.00 * (2/10) * 1.05 = $2.10
    await user.click(screen.getByText('Chocolate Cookies'));

    // Flour cost should reflect pantry pricing (hydrated)
    const costCells = document.querySelectorAll('.template__ingredient-cost');
    expect(costCells[0].textContent).toBe('$2.10');
  });

  // ---- RecipeCalc logo ----

  it('renders RecipeCalc logo linking to home', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<TemplatePage />);
    const logo = screen.getByText('RecipeCalc');
    expect(logo.closest('a')).toHaveAttribute('href', '/');
  });
});
