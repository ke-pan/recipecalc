import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Recipe, Ingredient } from '../../../../lib/calc/types';
import type { PantryItem } from '../../../../types/pantry';

// ---------------------------------------------------------------------------
// Mocks — must come before component import
// ---------------------------------------------------------------------------

const mockUseLicense = vi.fn(() => ({
  isUnlocked: false,
  license: null as { keyPrefix: string } | null,
  activate: vi.fn(),
  deactivate: vi.fn(),
}));

vi.mock('../../../../contexts/LicenseContext.js', () => ({
  useLicense: () => mockUseLicense(),
}));

const mockPantryAdd = vi.fn();
const mockPantryFindByName = vi.fn();
const mockUsePantry = vi.fn(() => ({
  pantry: [] as PantryItem[],
  add: mockPantryAdd,
  update: vi.fn(),
  remove: vi.fn(),
  findByName: mockPantryFindByName,
  getReferencingRecipeCount: vi.fn(),
}));

vi.mock('../../../../hooks/usePantry.js', () => ({
  usePantry: () => mockUsePantry(),
}));

// Now import the component (mocks are already in place)
import Step2Ingredients from '../Step2Ingredients';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecipe(overrides?: Partial<Recipe>): Recipe {
  return {
    name: 'Test Cookies',
    quantity: 24,
    quantityUnit: 'cookies',
    batchTimeHours: 2,
    ingredients: [],
    laborAndOverhead: {
      hourlyRate: 15,
      packaging: 2,
      overhead: 5,
      platformFees: 0,
    },
    ...overrides,
  };
}

function makeIngredient(overrides?: Partial<Ingredient>): Ingredient {
  return {
    id: 'ing-1',
    name: 'All-Purpose Flour',
    purchaseAmount: 5,
    purchaseUnit: 'lb',
    purchasePrice: 4.99,
    usedAmount: 2,
    usedUnit: 'lb',
    wastePercent: 0,
    ...overrides,
  };
}

function makePantryItem(overrides?: Partial<PantryItem>): PantryItem {
  return {
    id: 'pantry-1',
    name: 'Organic Flour',
    ingredientKey: 'all-purpose-flour',
    purchaseUnit: 'lb',
    purchaseAmount: 10,
    purchasePrice: 8.99,
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

interface RenderOptions {
  recipe?: Recipe;
  onIngredientsChange?: ReturnType<typeof vi.fn>;
  onValidChange?: ReturnType<typeof vi.fn>;
}

function renderStep2(opts: RenderOptions = {}) {
  const onIngredientsChange = opts.onIngredientsChange ?? vi.fn();
  const onValidChange = opts.onValidChange ?? vi.fn();
  const recipe = opts.recipe ?? makeRecipe();

  const result = render(
    <Step2Ingredients
      recipe={recipe}
      onIngredientsChange={onIngredientsChange}
      onValidChange={onValidChange}
    />,
  );

  return { ...result, onIngredientsChange, onValidChange, recipe };
}

// Helper: open form and fill all required fields using fireEvent
// (avoids autocomplete timing issues from userEvent.type)
async function fillIngredientForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides?: {
    name?: string;
    purchaseAmount?: string;
    purchasePrice?: string;
    usedAmount?: string;
  },
) {
  const name = overrides?.name ?? 'Xyz Custom';
  const purchaseAmount = overrides?.purchaseAmount ?? '5';
  const purchasePrice = overrides?.purchasePrice ?? '10';
  const usedAmount = overrides?.usedAmount ?? '2';

  // Open form
  const addBtn = screen.getByTestId('open-add-form-btn');
  await user.click(addBtn);

  // Use fireEvent for name to avoid autocomplete timing issues
  const nameInput = screen.getByLabelText('Ingredient Name');
  fireEvent.change(nameInput, { target: { value: name } });

  // Dismiss autocomplete by blurring the name field
  fireEvent.blur(nameInput);

  const amountInput = document.getElementById('purchase-amount') as HTMLInputElement;
  fireEvent.change(amountInput, { target: { value: purchaseAmount } });

  const priceInput = document.getElementById('purchase-price') as HTMLInputElement;
  fireEvent.change(priceInput, { target: { value: purchasePrice } });

  const usedInput = document.getElementById('used-amount') as HTMLInputElement;
  fireEvent.change(usedInput, { target: { value: usedAmount } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Step2Ingredients', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Default: free user, empty pantry
    mockUseLicense.mockReturnValue({
      isUnlocked: false,
      license: null,
      activate: vi.fn(),
      deactivate: vi.fn(),
    });
    mockUsePantry.mockReturnValue({
      pantry: [],
      add: mockPantryAdd,
      update: vi.fn(),
      remove: vi.fn(),
      findByName: mockPantryFindByName,
      getReferencingRecipeCount: vi.fn(),
    });
    mockPantryAdd.mockReset();
    mockPantryFindByName.mockReset();
    mockPantryFindByName.mockReturnValue(undefined);
  });

  afterEach(() => {
    // Flush any pending timers (e.g. handleNameBlur setTimeout) before teardown
    act(() => {
      vi.runAllTimers();
    });
    cleanup();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // 1. Rendering
  // -------------------------------------------------------------------------

  it('renders title and subtitle', () => {
    renderStep2();
    expect(screen.getByText('Ingredients')).toBeInTheDocument();
    expect(
      screen.getByText('Add each ingredient with its purchase price and amount used.'),
    ).toBeInTheDocument();
  });

  it('shows empty state when no ingredients', () => {
    renderStep2();
    expect(
      screen.getByText(/no ingredients yet/i),
    ).toBeInTheDocument();
  });

  it('shows Add Ingredient button', () => {
    renderStep2();
    expect(screen.getByTestId('open-add-form-btn')).toHaveTextContent('+ Add Ingredient');
  });

  // -------------------------------------------------------------------------
  // 2. Form expand/collapse
  // -------------------------------------------------------------------------

  it('opens inline form when Add Ingredient is clicked', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));
    expect(screen.getByTestId('ingredient-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Ingredient Name')).toBeInTheDocument();
  });

  it('closes form on Cancel', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));
    expect(screen.getByTestId('ingredient-form')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByTestId('ingredient-form')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 3. Autocomplete (free user — common ingredients only)
  // -------------------------------------------------------------------------

  it('shows autocomplete suggestions when typing "flo"', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'flo');

    // Should show flour-related suggestions
    const suggestions = screen.getByRole('listbox', { name: /ingredient suggestions/i });
    expect(suggestions).toBeInTheDocument();
    expect(within(suggestions).getByText('All-Purpose Flour')).toBeInTheDocument();
  });

  it('filters autocomplete suggestions based on input', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'bread');

    const suggestions = screen.getByRole('listbox', { name: /ingredient suggestions/i });
    expect(within(suggestions).getByText('Bread Flour')).toBeInTheDocument();
    // Should NOT show unrelated items
    expect(within(suggestions).queryByText('Butter')).not.toBeInTheDocument();
  });

  it('selects autocomplete item and fills default units', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'All-Purpose');

    // Click on suggestion
    const suggestion = screen.getByText('All-Purpose Flour');
    fireEvent.mouseDown(suggestion);

    // Name should be filled
    expect(nameInput).toHaveValue('All-Purpose Flour');

    // Default units should be set (lb for purchase, cup for used)
    expect(screen.getByLabelText('Unit', { selector: '#purchase-unit' })).toHaveValue('lb');
    expect(screen.getByLabelText('Unit', { selector: '#used-unit' })).toHaveValue('cup');
  });

  // -------------------------------------------------------------------------
  // 4. Unit dropdowns
  // -------------------------------------------------------------------------

  it('shows compatible units in "used" dropdown', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    // Default purchase unit is lb (weight), so used should show weight units
    const usedSelect = screen.getByLabelText('Unit', { selector: '#used-unit' });
    const options = within(usedSelect).getAllByRole('option');
    const optionValues = options.map((o) => o.getAttribute('value'));

    // Should include weight units
    expect(optionValues).toContain('g');
    expect(optionValues).toContain('oz');
    expect(optionValues).toContain('lb');
    expect(optionValues).toContain('kg');
  });

  it('shows cross-category units when known ingredient selected', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    // Select a known ingredient (has density data)
    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'All-Purpose');
    fireEvent.mouseDown(screen.getByText('All-Purpose Flour'));

    // Now "used" dropdown should include volume units too (cross-category)
    const usedSelect = screen.getByLabelText('Unit', { selector: '#used-unit' });
    const options = within(usedSelect).getAllByRole('option');
    const optionValues = options.map((o) => o.getAttribute('value'));

    expect(optionValues).toContain('cup');
    expect(optionValues).toContain('lb');
  });

  // -------------------------------------------------------------------------
  // 5. Adding ingredients
  // -------------------------------------------------------------------------

  it('adds ingredient to list when Add is clicked', async () => {
    const { onIngredientsChange } = renderStep2();

    await fillIngredientForm(user);
    await user.click(screen.getByTestId('add-ingredient-btn'));

    expect(onIngredientsChange).toHaveBeenCalledTimes(1);
    const newIngredients = onIngredientsChange.mock.calls[0][0] as Ingredient[];
    expect(newIngredients).toHaveLength(1);
    expect(newIngredients[0].name).toBe('Xyz Custom');
  });

  it('disables Add button when form is incomplete', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    // Only fill name, leave amounts empty
    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'Flour');

    expect(screen.getByTestId('add-ingredient-btn')).toBeDisabled();
  });

  it('shows cost preview when form is fully filled', async () => {
    renderStep2();
    await fillIngredientForm(user, {
      name: 'Flour',
      purchaseAmount: '5',
      purchasePrice: '10',
      usedAmount: '2',
    });

    // Cost = 10 * (2/5) * 1 = 4.00
    expect(screen.getByTestId('cost-preview')).toHaveTextContent('$4.00');
  });

  // -------------------------------------------------------------------------
  // 6. Ingredient list display
  // -------------------------------------------------------------------------

  it('displays existing ingredients with name, usage, and cost', () => {
    const ing = makeIngredient();
    const recipe = makeRecipe({ ingredients: [ing] });
    renderStep2({ recipe });

    expect(screen.getByText('All-Purpose Flour')).toBeInTheDocument();
    expect(screen.getByText(/2 lb used/)).toBeInTheDocument();
    // Cost = 4.99 * (2/5) = 1.996 -> $2.00
    // Use getAllByText because both the item cost and subtotal show $2.00
    const costElements = screen.getAllByText('$2.00');
    expect(costElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows subtotal when ingredients exist', () => {
    const recipe = makeRecipe({
      ingredients: [
        makeIngredient({ id: 'ing-1', purchasePrice: 10, purchaseAmount: 5, usedAmount: 2 }),
        makeIngredient({ id: 'ing-2', name: 'Sugar', purchasePrice: 5, purchaseAmount: 4, usedAmount: 1 }),
      ],
    });
    renderStep2({ recipe });

    // Cost1 = 10*(2/5) = 4.00, Cost2 = 5*(1/4) = 1.25, total = 5.25
    expect(screen.getByTestId('ingredient-subtotal')).toHaveTextContent('$5.25');
  });

  // -------------------------------------------------------------------------
  // 7. Edit ingredient
  // -------------------------------------------------------------------------

  it('opens edit form when Edit is clicked', async () => {
    const ing = makeIngredient();
    const recipe = makeRecipe({ ingredients: [ing] });
    renderStep2({ recipe });

    await user.click(screen.getByLabelText('Edit All-Purpose Flour'));

    expect(screen.getByTestId('ingredient-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Ingredient Name')).toHaveValue('All-Purpose Flour');
  });

  it('saves edited ingredient', async () => {
    const ing = makeIngredient();
    const recipe = makeRecipe({ ingredients: [ing] });
    const { onIngredientsChange } = renderStep2({ recipe });

    await user.click(screen.getByLabelText('Edit All-Purpose Flour'));

    // Change the price
    const priceInput = screen.getByLabelText('Price ($)');
    await user.clear(priceInput);
    await user.type(priceInput, '9.99');

    // Save button should say "Save" in edit mode
    const saveBtn = screen.getByTestId('add-ingredient-btn');
    expect(saveBtn).toHaveTextContent('Save');
    await user.click(saveBtn);

    expect(onIngredientsChange).toHaveBeenCalledTimes(1);
    const updated = onIngredientsChange.mock.calls[0][0] as Ingredient[];
    expect(updated).toHaveLength(1);
    expect(updated[0].purchasePrice).toBe(9.99);
  });

  // -------------------------------------------------------------------------
  // 8. Delete ingredient
  // -------------------------------------------------------------------------

  it('removes ingredient when Delete is clicked', async () => {
    const ing = makeIngredient();
    const recipe = makeRecipe({ ingredients: [ing] });
    const { onIngredientsChange } = renderStep2({ recipe });

    await user.click(screen.getByLabelText('Delete All-Purpose Flour'));

    expect(onIngredientsChange).toHaveBeenCalledTimes(1);
    const updated = onIngredientsChange.mock.calls[0][0] as Ingredient[];
    expect(updated).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 9. Waste percentage
  // -------------------------------------------------------------------------

  it('waste field is hidden by default', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    expect(screen.queryByLabelText('Waste %')).not.toBeInTheDocument();
    expect(screen.getByText('+ Add waste percentage')).toBeInTheDocument();
  });

  it('shows waste field after toggle', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));
    await user.click(screen.getByText('+ Add waste percentage'));

    expect(screen.getByLabelText('Waste %')).toBeInTheDocument();
  });

  it('waste 10% increases cost by 1.1x', async () => {
    renderStep2();
    await fillIngredientForm(user, {
      name: 'Flour',
      purchaseAmount: '10',
      purchasePrice: '10',
      usedAmount: '5',
    });

    // Before waste: cost = 10 * (5/10) = 5.00
    expect(screen.getByTestId('cost-preview')).toHaveTextContent('$5.00');

    // Add 10% waste
    await user.click(screen.getByText('+ Add waste percentage'));
    const wasteInput = screen.getByLabelText('Waste %');
    await user.clear(wasteInput);
    await user.type(wasteInput, '10');

    // After waste: cost = 5.00 * 1.1 = 5.50
    expect(screen.getByTestId('cost-preview')).toHaveTextContent('$5.50');
  });

  // -------------------------------------------------------------------------
  // 10. Validation callback
  // -------------------------------------------------------------------------

  it('calls onValidChange(false) when list is empty', () => {
    const { onValidChange } = renderStep2();
    expect(onValidChange).toHaveBeenCalledWith(false);
  });

  it('calls onValidChange(true) when list has items', () => {
    const recipe = makeRecipe({ ingredients: [makeIngredient()] });
    const { onValidChange } = renderStep2({ recipe });
    expect(onValidChange).toHaveBeenCalledWith(true);
  });

  // -------------------------------------------------------------------------
  // 11. Displays ingredient with waste in list
  // -------------------------------------------------------------------------

  it('shows waste percentage in ingredient list item', () => {
    const ing = makeIngredient({ wastePercent: 10 });
    const recipe = makeRecipe({ ingredients: [ing] });
    renderStep2({ recipe });

    expect(screen.getByText(/\+10% waste/)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 12. Multiple ingredients
  // -------------------------------------------------------------------------

  it('displays multiple ingredients correctly', () => {
    const recipe = makeRecipe({
      ingredients: [
        makeIngredient({ id: 'a', name: 'Flour' }),
        makeIngredient({ id: 'b', name: 'Sugar' }),
        makeIngredient({ id: 'c', name: 'Butter' }),
      ],
    });
    renderStep2({ recipe });

    expect(screen.getByText('Flour')).toBeInTheDocument();
    expect(screen.getByText('Sugar')).toBeInTheDocument();
    expect(screen.getByText('Butter')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 13. Form clears after adding
  // -------------------------------------------------------------------------

  it('form closes after adding ingredient', async () => {
    renderStep2();
    await fillIngredientForm(user);
    await user.click(screen.getByTestId('add-ingredient-btn'));

    // Form should be closed
    expect(screen.queryByTestId('ingredient-form')).not.toBeInTheDocument();
    // Add button should be visible again
    expect(screen.getByTestId('open-add-form-btn')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 14. Keyboard navigation in autocomplete
  // -------------------------------------------------------------------------

  it('navigates autocomplete with arrow keys', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'flo');

    // Press ArrowDown
    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // Press ArrowDown again
    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  // -------------------------------------------------------------------------
  // 15. Data-testid on root element
  // -------------------------------------------------------------------------

  it('has data-testid on root element', () => {
    renderStep2();
    expect(screen.getByTestId('step2-ingredients')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 16. Purchase unit fields
  // -------------------------------------------------------------------------

  it('purchase unit dropdown shows all unit types', async () => {
    renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    const purchaseSelect = screen.getByLabelText('Unit', { selector: '#purchase-unit' });
    const options = within(purchaseSelect).getAllByRole('option');
    const optionValues = options.map((o) => o.getAttribute('value'));

    // Should include weight, volume, and count units
    expect(optionValues).toContain('lb');
    expect(optionValues).toContain('cup');
    expect(optionValues).toContain('each');
  });

  // -------------------------------------------------------------------------
  // 17. ingredientKey persisted on all ingredients
  // -------------------------------------------------------------------------

  it('persists ingredientKey when adding a common ingredient', async () => {
    const { onIngredientsChange } = renderStep2();
    await user.click(screen.getByTestId('open-add-form-btn'));

    // Select All-Purpose Flour from autocomplete
    const nameInput = screen.getByLabelText('Ingredient Name');
    await user.type(nameInput, 'All-Purpose');
    fireEvent.mouseDown(screen.getByText('All-Purpose Flour'));

    // Fill purchase info
    const amountInput = document.getElementById('purchase-amount') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '5' } });
    const priceInput = document.getElementById('purchase-price') as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: '4.99' } });
    const usedInput = document.getElementById('used-amount') as HTMLInputElement;
    fireEvent.change(usedInput, { target: { value: '2' } });

    await user.click(screen.getByTestId('add-ingredient-btn'));

    const added = onIngredientsChange.mock.calls[0][0] as Ingredient[];
    expect(added[0].ingredientKey).toBe('all-purpose-flour');
  });

  it('generates slugified ingredientKey for manually typed ingredients', async () => {
    const { onIngredientsChange } = renderStep2();
    await fillIngredientForm(user, { name: 'My Custom Flour' });
    await user.click(screen.getByTestId('add-ingredient-btn'));

    const added = onIngredientsChange.mock.calls[0][0] as Ingredient[];
    expect(added[0].ingredientKey).toBe('my-custom-flour');
  });

  // =========================================================================
  // PAID USER — Pantry autocomplete
  // =========================================================================

  describe('paid user — Pantry autocomplete', () => {
    const pantryFlour = makePantryItem({
      id: 'pantry-flour',
      name: 'Organic Flour',
      ingredientKey: 'all-purpose-flour',
      purchaseUnit: 'lb',
      purchaseAmount: 10,
      purchasePrice: 8.99,
    });

    const pantrySugar = makePantryItem({
      id: 'pantry-sugar',
      name: 'Brown Sugar',
      ingredientKey: 'brown-sugar',
      purchaseUnit: 'lb',
      purchaseAmount: 4,
      purchasePrice: 3.49,
    });

    beforeEach(() => {
      mockUseLicense.mockReturnValue({
        isUnlocked: true,
        license: { keyPrefix: 'test-key' },
        activate: vi.fn(),
        deactivate: vi.fn(),
      });
      mockUsePantry.mockReturnValue({
        pantry: [pantryFlour, pantrySugar],
        add: mockPantryAdd,
        update: vi.fn(),
        remove: vi.fn(),
        findByName: mockPantryFindByName,
        getReferencingRecipeCount: vi.fn(),
      });
    });

    it('shows Pantry items first with "My Pantry" badge', async () => {
      renderStep2();
      await user.click(screen.getByTestId('open-add-form-btn'));

      const nameInput = screen.getByLabelText('Ingredient Name');
      await user.type(nameInput, 'flour');

      const suggestions = screen.getByRole('listbox', { name: /ingredient suggestions/i });
      const options = within(suggestions).getAllByRole('option');

      // Pantry item "Organic Flour" should come first
      expect(options[0]).toHaveTextContent('Organic Flour');
      // It should have the badge
      expect(within(options[0]).getByTestId('pantry-badge')).toHaveTextContent('My Pantry');

      // Common ingredients should follow (without badge)
      const commonOptions = options.filter(
        (opt) => within(opt).queryByTestId('pantry-badge') === null,
      );
      expect(commonOptions.length).toBeGreaterThan(0);
    });

    it('deduplicates pantry items with same name as common ingredients', async () => {
      renderStep2();
      await user.click(screen.getByTestId('open-add-form-btn'));

      const nameInput = screen.getByLabelText('Ingredient Name');
      await user.type(nameInput, 'Brown Sugar');

      const suggestions = screen.getByRole('listbox', { name: /ingredient suggestions/i });
      const brownSugarItems = within(suggestions)
        .getAllByRole('option')
        .filter((opt) => opt.textContent?.includes('Brown Sugar'));

      // Should only show pantry version (pantry takes priority, dedup by name)
      expect(brownSugarItems).toHaveLength(1);
      expect(within(brownSugarItems[0]).getByTestId('pantry-badge')).toBeInTheDocument();
    });

    it('auto-fills purchase fields when selecting a Pantry item', async () => {
      renderStep2();
      await user.click(screen.getByTestId('open-add-form-btn'));

      const nameInput = screen.getByLabelText('Ingredient Name');
      await user.type(nameInput, 'Organic');

      // Select the pantry item
      fireEvent.mouseDown(screen.getByText('Organic Flour'));

      // Name should be filled
      expect(nameInput).toHaveValue('Organic Flour');

      // Purchase fields should be auto-filled from pantry
      expect(document.getElementById('purchase-amount')).toHaveValue(10);
      expect(screen.getByLabelText('Unit', { selector: '#purchase-unit' })).toHaveValue('lb');
      expect(document.getElementById('purchase-price')).toHaveValue(8.99);
    });

    it('sets pantryId and ingredientKey when selecting a Pantry item and adding', async () => {
      const { onIngredientsChange } = renderStep2();
      await user.click(screen.getByTestId('open-add-form-btn'));

      const nameInput = screen.getByLabelText('Ingredient Name');
      await user.type(nameInput, 'Organic');
      fireEvent.mouseDown(screen.getByText('Organic Flour'));

      // Fill used amount
      const usedInput = document.getElementById('used-amount') as HTMLInputElement;
      fireEvent.change(usedInput, { target: { value: '3' } });

      await user.click(screen.getByTestId('add-ingredient-btn'));

      const added = onIngredientsChange.mock.calls[0][0] as Ingredient[];
      expect(added[0].pantryId).toBe('pantry-flour');
      expect(added[0].ingredientKey).toBe('all-purpose-flour');
    });

    it('does not show Pantry items for free users', async () => {
      // Override to free user
      mockUseLicense.mockReturnValue({
        isUnlocked: false,
        license: null,
        activate: vi.fn(),
        deactivate: vi.fn(),
      });

      renderStep2();
      await user.click(screen.getByTestId('open-add-form-btn'));

      const nameInput = screen.getByLabelText('Ingredient Name');
      await user.type(nameInput, 'Organic');

      // Should not find "Organic Flour" (it's only in pantry)
      expect(screen.queryByText('Organic Flour')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // PAID USER — "Save to My Pantry" checkbox
  // =========================================================================

  describe('paid user — Save to My Pantry', () => {
    beforeEach(() => {
      mockUseLicense.mockReturnValue({
        isUnlocked: true,
        license: { keyPrefix: 'test-key' },
        activate: vi.fn(),
        deactivate: vi.fn(),
      });
      mockUsePantry.mockReturnValue({
        pantry: [],
        add: mockPantryAdd,
        update: vi.fn(),
        remove: vi.fn(),
        findByName: mockPantryFindByName,
        getReferencingRecipeCount: vi.fn(),
      });
      mockPantryFindByName.mockReturnValue(undefined);
    });

    it('shows "Save to My Pantry" checkbox for non-pantry ingredients with price filled', async () => {
      renderStep2();
      await fillIngredientForm(user, {
        name: 'Custom Ingredient',
        purchaseAmount: '5',
        purchasePrice: '10',
        usedAmount: '2',
      });

      expect(screen.getByTestId('save-to-pantry')).toBeInTheDocument();
      expect(screen.getByText('Save to My Pantry')).toBeInTheDocument();
    });

    it('does not show "Save to My Pantry" for free users', async () => {
      mockUseLicense.mockReturnValue({
        isUnlocked: false,
        license: null,
        activate: vi.fn(),
        deactivate: vi.fn(),
      });

      renderStep2();
      await fillIngredientForm(user, {
        name: 'Custom Ingredient',
        purchaseAmount: '5',
        purchasePrice: '10',
        usedAmount: '2',
      });

      expect(screen.queryByTestId('save-to-pantry')).not.toBeInTheDocument();
    });

    it('does not show "Save to My Pantry" when ingredient is already in Pantry', async () => {
      mockPantryFindByName.mockReturnValue(makePantryItem({ name: 'Custom Ingredient' }));

      renderStep2();
      await fillIngredientForm(user, {
        name: 'Custom Ingredient',
        purchaseAmount: '5',
        purchasePrice: '10',
        usedAmount: '2',
      });

      expect(screen.queryByTestId('save-to-pantry')).not.toBeInTheDocument();
    });

    it('calls pantryAdd when checkbox is checked and ingredient is added', async () => {
      const createdPantryItem = makePantryItem({
        id: 'new-pantry-id',
        name: 'Custom Ingredient',
        ingredientKey: 'custom-ingredient',
      });
      mockPantryAdd.mockReturnValue(createdPantryItem);

      const { onIngredientsChange } = renderStep2();
      await fillIngredientForm(user, {
        name: 'Custom Ingredient',
        purchaseAmount: '5',
        purchasePrice: '10',
        usedAmount: '2',
      });

      // Check the "Save to My Pantry" checkbox
      const checkbox = screen.getByTestId('save-to-pantry').querySelector('input[type="checkbox"]')!;
      await user.click(checkbox);

      // Add the ingredient
      await user.click(screen.getByTestId('add-ingredient-btn'));

      // pantryAdd should be called with the correct data
      expect(mockPantryAdd).toHaveBeenCalledTimes(1);
      expect(mockPantryAdd).toHaveBeenCalledWith({
        name: 'Custom Ingredient',
        ingredientKey: 'custom-ingredient',
        purchaseUnit: 'lb',
        purchaseAmount: 5,
        purchasePrice: 10,
      });

      // The ingredient should be linked to the pantry item
      const added = onIngredientsChange.mock.calls[0][0] as Ingredient[];
      expect(added[0].pantryId).toBe('new-pantry-id');
    });

    it('does not call pantryAdd when checkbox is unchecked', async () => {
      const { onIngredientsChange } = renderStep2();
      await fillIngredientForm(user, {
        name: 'Custom Ingredient',
        purchaseAmount: '5',
        purchasePrice: '10',
        usedAmount: '2',
      });

      // Don't check the checkbox, just add
      await user.click(screen.getByTestId('add-ingredient-btn'));

      expect(mockPantryAdd).not.toHaveBeenCalled();

      const added = onIngredientsChange.mock.calls[0][0] as Ingredient[];
      expect(added[0].pantryId).toBeUndefined();
    });

    it('does not show checkbox when selecting a Pantry item (already in pantry)', async () => {
      const pantryItem = makePantryItem({
        id: 'pantry-flour',
        name: 'Organic Flour',
        ingredientKey: 'all-purpose-flour',
        purchaseUnit: 'lb',
        purchaseAmount: 10,
        purchasePrice: 8.99,
      });

      mockUsePantry.mockReturnValue({
        pantry: [pantryItem],
        add: mockPantryAdd,
        update: vi.fn(),
        remove: vi.fn(),
        findByName: mockPantryFindByName,
        getReferencingRecipeCount: vi.fn(),
      });

      renderStep2();
      await user.click(screen.getByTestId('open-add-form-btn'));

      const nameInput = screen.getByLabelText('Ingredient Name');
      await user.type(nameInput, 'Organic');
      fireEvent.mouseDown(screen.getByText('Organic Flour'));

      // Fill used amount to make form complete
      const usedInput = document.getElementById('used-amount') as HTMLInputElement;
      fireEvent.change(usedInput, { target: { value: '3' } });

      // Checkbox should NOT appear because the item came from Pantry
      expect(screen.queryByTestId('save-to-pantry')).not.toBeInTheDocument();
    });
  });
});
