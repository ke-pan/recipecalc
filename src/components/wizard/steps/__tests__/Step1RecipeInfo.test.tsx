import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Step1RecipeInfo from '../Step1RecipeInfo';
import type { Recipe } from '../../../../lib/calc/types';

/** Minimal valid recipe for testing */
function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    name: '',
    quantity: 0,
    quantityUnit: '',
    batchTimeHours: 0,
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

describe('Step1RecipeInfo', () => {
  // --- Rendering ---

  it('renders the conversational title "What did you make?"', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'What did you make?' }),
    ).toBeInTheDocument();
  });

  it('renders three input fields with correct placeholders', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    expect(
      screen.getByPlaceholderText('e.g. Chocolate Chip Cookies'),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('24')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('cookies')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('2')).toBeInTheDocument();
  });

  it('renders the microcopy under batch time', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "We'll use this to calculate your time's worth later.",
      ),
    ).toBeInTheDocument();
  });

  // --- Data round-trip (restoring from recipe prop) ---

  it('populates fields from recipe prop (round-trip)', () => {
    const recipe = makeRecipe({
      name: 'Sourdough Bread',
      quantity: 2,
      quantityUnit: 'loaves',
      batchTimeHours: 4,
    });

    render(
      <Step1RecipeInfo
        recipe={recipe}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Sourdough Bread')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('loaves')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });

  // --- onUpdate callback ---

  it('calls onUpdate when recipe name changes', () => {
    const onUpdate = vi.fn();

    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={onUpdate}
        onValidChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Chocolate Chip Cookies'), {
      target: { value: 'Brownies' },
    });

    expect(onUpdate).toHaveBeenCalledWith({ name: 'Brownies' });
  });

  it('calls onUpdate when quantity changes', () => {
    const onUpdate = vi.fn();

    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={onUpdate}
        onValidChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('24'), {
      target: { value: '12', valueAsNumber: 12 },
    });

    expect(onUpdate).toHaveBeenCalledWith({ quantity: 12 });
  });

  // --- Validation: onValidChange ---

  it('calls onValidChange(false) when fields are empty', () => {
    const onValidChange = vi.fn();

    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={onValidChange}
      />,
    );

    // Empty recipe => invalid => onValidChange(false) on mount
    expect(onValidChange).toHaveBeenCalledWith(false);
  });

  it('calls onValidChange(true) when all required fields are valid', () => {
    const onValidChange = vi.fn();

    render(
      <Step1RecipeInfo
        recipe={makeRecipe({
          name: 'Cookies',
          quantity: 24,
          batchTimeHours: 2,
        })}
        onUpdate={vi.fn()}
        onValidChange={onValidChange}
      />,
    );

    expect(onValidChange).toHaveBeenCalledWith(true);
  });

  // --- Inline error display ---

  it('shows inline error for empty name after blur', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    const nameInput = screen.getByPlaceholderText('e.g. Chocolate Chip Cookies');
    fireEvent.blur(nameInput);

    expect(screen.getByText('Please name your recipe.')).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error styling (step1__input--error) on invalid fields after blur', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    const nameInput = screen.getByPlaceholderText('e.g. Chocolate Chip Cookies');
    fireEvent.blur(nameInput);

    expect(nameInput).toHaveClass('step1__input--error');
  });

  it('clears error when field becomes valid after being touched', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    const nameInput = screen.getByPlaceholderText('e.g. Chocolate Chip Cookies');

    // Trigger touched state
    fireEvent.blur(nameInput);
    expect(screen.getByText('Please name your recipe.')).toBeInTheDocument();

    // Fix the error
    fireEvent.change(nameInput, { target: { value: 'Brownies' } });
    expect(screen.queryByText('Please name your recipe.')).not.toBeInTheDocument();
  });

  it('shows quantity error for zero value after blur', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    const quantityInput = screen.getByPlaceholderText('24');
    fireEvent.blur(quantityInput);

    expect(
      screen.getByText('Quantity must be greater than zero.'),
    ).toBeInTheDocument();
  });

  it('does not show errors before fields are touched', () => {
    render(
      <Step1RecipeInfo
        recipe={makeRecipe()}
        onUpdate={vi.fn()}
        onValidChange={vi.fn()}
      />,
    );

    // No alerts should be visible before any interaction
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });
});
