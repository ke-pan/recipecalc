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
const DEFAULTS_KEY = 'recipecalc_defaults';

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

function makeDefaults(overrides: Record<string, unknown> = {}) {
  return {
    hourlyRate: 15,
    packaging: 5,
    overhead: 3,
    platformFees: 2,
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
// Helper: open Quick Add form with license + optionally pantry/defaults
// ---------------------------------------------------------------------------

async function openQuickAdd(opts: {
  pantry?: object[];
  defaults?: object;
  recipes?: object[];
} = {}) {
  const user = userEvent.setup();
  store[LICENSE_KEY] = makeLicenseJSON();
  if (opts.pantry) store[PANTRY_KEY] = JSON.stringify(opts.pantry);
  if (opts.defaults) store[DEFAULTS_KEY] = JSON.stringify(opts.defaults);
  if (opts.recipes) store[RECIPES_KEY] = JSON.stringify(opts.recipes);

  render(<TemplatePage />);
  await user.click(screen.getByTestId('quick-add-btn'));
  return user;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Quick Add Form', () => {
  // ---- Visibility ----

  it('shows Quick Add button in toolbar', () => {
    store[LICENSE_KEY] = makeLicenseJSON();
    render(<TemplatePage />);
    expect(screen.getByTestId('quick-add-btn')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-btn')).toHaveTextContent('Quick Add');
  });

  it('opens Quick Add form when button is clicked', async () => {
    const user = await openQuickAdd();
    expect(screen.getByTestId('quick-add-form')).toBeInTheDocument();
  });

  it('disables Quick Add button while form is open', async () => {
    const user = await openQuickAdd();
    expect(screen.getByTestId('quick-add-btn')).toBeDisabled();
  });

  it('closes Quick Add form when Cancel is clicked', async () => {
    const user = await openQuickAdd();
    await user.click(screen.getByTestId('quick-add-cancel'));
    expect(screen.queryByTestId('quick-add-form')).not.toBeInTheDocument();
  });

  // ---- Recipe Info Fields ----

  it('renders recipe info fields (name, yield, batch time)', async () => {
    await openQuickAdd();
    expect(screen.getByTestId('quick-add-name')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-yield-amount')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-yield-unit')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-batch-time')).toBeInTheDocument();
  });

  // ---- Ingredient rows ----

  it('starts with one empty ingredient row', async () => {
    await openQuickAdd();
    const rows = screen.getAllByTestId('quick-add-ingredient-row');
    expect(rows).toHaveLength(1);
  });

  it('can add additional ingredient rows', async () => {
    const user = await openQuickAdd();
    await user.click(screen.getByTestId('quick-add-add-ingredient'));
    const rows = screen.getAllByTestId('quick-add-ingredient-row');
    expect(rows).toHaveLength(2);
  });

  it('can remove an ingredient row (when more than one exists)', async () => {
    const user = await openQuickAdd();
    await user.click(screen.getByTestId('quick-add-add-ingredient'));
    expect(screen.getAllByTestId('quick-add-ingredient-row')).toHaveLength(2);

    const removeButtons = screen.getAllByTestId('quick-add-remove-ingredient');
    await user.click(removeButtons[0]);
    expect(screen.getAllByTestId('quick-add-ingredient-row')).toHaveLength(1);
  });

  // ---- Pantry selection ----

  it('populates ingredient fields when pantry item is selected', async () => {
    const pantryItem = makePantryItem();
    const user = await openQuickAdd({ pantry: [pantryItem] });

    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, pantryItem.id as string);

    // Fields should be populated from pantry
    expect(screen.getByTestId('quick-add-ingredient-name')).toHaveValue('All-Purpose Flour');
    expect(screen.getByTestId('quick-add-purchase-amount')).toHaveValue(5);
    expect(screen.getByTestId('quick-add-purchase-price')).toHaveValue(4.99);
  });

  it('makes purchase fields readonly when pantry item is selected', async () => {
    const pantryItem = makePantryItem();
    const user = await openQuickAdd({ pantry: [pantryItem] });

    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, pantryItem.id as string);

    expect(screen.getByTestId('quick-add-ingredient-name')).toHaveAttribute('readonly');
    expect(screen.getByTestId('quick-add-purchase-amount')).toHaveAttribute('readonly');
    expect(screen.getByTestId('quick-add-purchase-price')).toHaveAttribute('readonly');
  });

  it('does not show "Save to My Pantry" for pantry-linked ingredients', async () => {
    const pantryItem = makePantryItem();
    const user = await openQuickAdd({ pantry: [pantryItem] });

    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, pantryItem.id as string);

    expect(screen.queryByTestId('quick-add-save-pantry')).not.toBeInTheDocument();
  });

  // ---- Save to Pantry checkbox ----

  it('shows "Save to My Pantry" checkbox for manual ingredients with a name', async () => {
    const user = await openQuickAdd();

    // Select manual mode
    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, '__manual__');

    // Type a name
    const nameInput = screen.getByTestId('quick-add-ingredient-name');
    await user.type(nameInput, 'Custom Flour');

    expect(screen.getByTestId('quick-add-save-pantry')).toBeInTheDocument();
  });

  // ---- Labor/Overhead defaults ----

  it('shows "Using your defaults" when defaults are non-zero', async () => {
    await openQuickAdd({ defaults: makeDefaults() });
    expect(screen.getByTestId('quick-add-defaults-notice')).toBeInTheDocument();
    expect(screen.getByText('Using your defaults')).toBeInTheDocument();
  });

  it('shows "Override for this recipe" link when defaults exist', async () => {
    await openQuickAdd({ defaults: makeDefaults() });
    expect(screen.getByTestId('quick-add-override-link')).toBeInTheDocument();
  });

  it('shows labor fields when Override is clicked', async () => {
    const user = await openQuickAdd({ defaults: makeDefaults() });
    await user.click(screen.getByTestId('quick-add-override-link'));
    expect(screen.getByTestId('quick-add-labor-fields')).toBeInTheDocument();
    expect(screen.getByTestId('quick-add-hourly-rate')).toBeInTheDocument();
  });

  it('shows labor fields directly when no defaults are set', async () => {
    await openQuickAdd({ defaults: { hourlyRate: 0, packaging: 0, overhead: 0, platformFees: 0 } });
    expect(screen.getByTestId('quick-add-labor-fields')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-add-defaults-notice')).not.toBeInTheDocument();
  });

  // ---- Validation ----

  it('shows validation errors when saving with empty fields', async () => {
    const user = await openQuickAdd();
    await user.click(screen.getByTestId('quick-add-save'));
    expect(screen.getByTestId('quick-add-errors')).toBeInTheDocument();
    expect(screen.getByText('Recipe name is required.')).toBeInTheDocument();
  });

  // ---- Full save flow ----

  it('saves a recipe and closes the form', async () => {
    const user = await openQuickAdd({ defaults: makeDefaults() });

    // Fill recipe info
    await user.type(screen.getByTestId('quick-add-name'), 'Test Cake');
    await user.type(screen.getByTestId('quick-add-yield-amount'), '12');
    await user.type(screen.getByTestId('quick-add-yield-unit'), 'slices');
    await user.type(screen.getByTestId('quick-add-batch-time'), '1.5');

    // Fill ingredient (manual mode)
    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, '__manual__');
    await user.type(screen.getByTestId('quick-add-ingredient-name'), 'Butter');
    await user.type(screen.getByTestId('quick-add-purchase-amount'), '1');
    await user.type(screen.getByTestId('quick-add-purchase-price'), '5.99');
    await user.type(screen.getByTestId('quick-add-used-amount'), '0.5');

    // Save
    await user.click(screen.getByTestId('quick-add-save'));

    // Form should close
    expect(screen.queryByTestId('quick-add-form')).not.toBeInTheDocument();

    // Recipe should appear in the table
    expect(screen.getByText('Test Cake')).toBeInTheDocument();
    expect(screen.getByText(/12 slices/)).toBeInTheDocument();
  });

  it('saves a recipe with pantry-linked ingredient and sets pantryId', async () => {
    const pantryItem = makePantryItem();
    const user = await openQuickAdd({ pantry: [pantryItem], defaults: makeDefaults() });

    // Fill recipe info
    await user.type(screen.getByTestId('quick-add-name'), 'Flour Cookie');
    await user.type(screen.getByTestId('quick-add-yield-amount'), '24');
    await user.type(screen.getByTestId('quick-add-yield-unit'), 'cookies');
    await user.type(screen.getByTestId('quick-add-batch-time'), '2');

    // Select pantry item
    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, pantryItem.id as string);
    await user.type(screen.getByTestId('quick-add-used-amount'), '2');

    // Save
    await user.click(screen.getByTestId('quick-add-save'));

    // Form should close, recipe should appear
    expect(screen.queryByTestId('quick-add-form')).not.toBeInTheDocument();
    expect(screen.getByText('Flour Cookie')).toBeInTheDocument();

    // Verify saved recipe data in localStorage has pantryId
    const savedRecipes = JSON.parse(store[RECIPES_KEY]);
    expect(savedRecipes).toHaveLength(1);
    expect(savedRecipes[0].recipe.ingredients[0].pantryId).toBe(pantryItem.id);
  });

  it('creates a pantry item when "Save to My Pantry" is checked', async () => {
    const user = await openQuickAdd({ defaults: makeDefaults() });

    // Fill recipe info
    await user.type(screen.getByTestId('quick-add-name'), 'Custom Recipe');
    await user.type(screen.getByTestId('quick-add-yield-amount'), '6');
    await user.type(screen.getByTestId('quick-add-yield-unit'), 'servings');
    await user.type(screen.getByTestId('quick-add-batch-time'), '1');

    // Manual ingredient
    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, '__manual__');
    await user.type(screen.getByTestId('quick-add-ingredient-name'), 'Fancy Vanilla');
    await user.type(screen.getByTestId('quick-add-purchase-amount'), '4');
    await user.type(screen.getByTestId('quick-add-purchase-price'), '12.99');
    await user.type(screen.getByTestId('quick-add-used-amount'), '1');

    // Check "Save to My Pantry"
    const saveCheckbox = within(screen.getByTestId('quick-add-save-pantry')).getByRole('checkbox');
    await user.click(saveCheckbox);

    // Save
    await user.click(screen.getByTestId('quick-add-save'));

    // Check pantry in localStorage
    const savedPantry = JSON.parse(store[PANTRY_KEY]);
    expect(savedPantry).toHaveLength(1);
    expect(savedPantry[0].name).toBe('Fancy Vanilla');
    expect(savedPantry[0].purchasePrice).toBe(12.99);

    // Recipe's ingredient should have pantryId set to the new pantry item's id
    const savedRecipes = JSON.parse(store[RECIPES_KEY]);
    expect(savedRecipes[0].recipe.ingredients[0].pantryId).toBe(savedPantry[0].id);
  });

  it('creates a SavedRecipe with same data structure as wizard', async () => {
    const user = await openQuickAdd({ defaults: makeDefaults() });

    await user.type(screen.getByTestId('quick-add-name'), 'Structure Test');
    await user.type(screen.getByTestId('quick-add-yield-amount'), '10');
    await user.type(screen.getByTestId('quick-add-yield-unit'), 'pieces');
    await user.type(screen.getByTestId('quick-add-batch-time'), '2');

    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, '__manual__');
    await user.type(screen.getByTestId('quick-add-ingredient-name'), 'Sugar');
    await user.type(screen.getByTestId('quick-add-purchase-amount'), '4');
    await user.type(screen.getByTestId('quick-add-purchase-price'), '3.49');
    await user.type(screen.getByTestId('quick-add-used-amount'), '1');

    await user.click(screen.getByTestId('quick-add-save'));

    const savedRecipes = JSON.parse(store[RECIPES_KEY]);
    const saved = savedRecipes[0];

    // Verify SavedRecipe shape
    expect(saved).toHaveProperty('id');
    expect(saved).toHaveProperty('version', 1);
    expect(saved).toHaveProperty('savedAt');
    expect(saved).toHaveProperty('updatedAt');
    expect(saved).toHaveProperty('targetCostRatio', 0.3);

    // Verify Recipe shape
    const recipe = saved.recipe;
    expect(recipe.name).toBe('Structure Test');
    expect(recipe.quantity).toBe(10);
    expect(recipe.quantityUnit).toBe('pieces');
    expect(recipe.batchTimeHours).toBe(2);
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.laborAndOverhead).toEqual({
      hourlyRate: 15,
      packaging: 5,
      overhead: 3,
      platformFees: 2,
    });

    // Verify Ingredient shape
    const ing = recipe.ingredients[0];
    expect(ing).toHaveProperty('id');
    expect(ing.name).toBe('Sugar');
    expect(ing.purchaseAmount).toBe(4);
    expect(ing.purchaseUnit).toBe('lb');
    expect(ing.purchasePrice).toBe(3.49);
    expect(ing.usedAmount).toBe(1);
    expect(ing.usedUnit).toBe('lb');
    expect(ing.wastePercent).toBe(0);
  });

  // ---- Cost preview ----

  it('shows ingredient cost preview when valid data is entered', async () => {
    const user = await openQuickAdd();

    const select = screen.getByTestId('quick-add-pantry-select');
    await user.selectOptions(select, '__manual__');
    await user.type(screen.getByTestId('quick-add-ingredient-name'), 'Test');
    await user.type(screen.getByTestId('quick-add-purchase-amount'), '2');
    await user.type(screen.getByTestId('quick-add-purchase-price'), '10');
    await user.type(screen.getByTestId('quick-add-used-amount'), '1');

    // Cost = 10 * (1/2) * 1.0 = $5.00
    expect(screen.getByTestId('quick-add-cost-preview')).toHaveTextContent('$5.00');
  });
});
