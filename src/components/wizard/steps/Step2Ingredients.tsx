import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Ingredient, Recipe } from '../../../lib/calc/types.js';
import { COMMON_INGREDIENTS } from '../../../data/common-ingredients.js';
import type { CommonIngredient } from '../../../data/common-ingredients.js';
import {
  getCompatibleUnits,
  canConvert,
  convert,
  convertCrossCategory,
  getUnitCategory,
} from '../../../lib/units/converter.js';
import { calculateIngredientCost, roundCents } from '../../../lib/calc/pricing.js';
import { formatCurrency } from '../../../lib/format.js';
import { WEIGHT_UNITS, VOLUME_UNITS, COUNT_UNITS } from '../../../lib/units/conversion-factors.js';
import './step2.css';

interface Step2Props {
  recipe: Recipe;
  onIngredientsChange: (ingredients: Ingredient[]) => void;
  onValidChange: (valid: boolean) => void;
}

interface IngredientForm {
  name: string;
  ingredientId: string;
  purchaseAmount: string;
  purchaseUnit: string;
  purchasePrice: string;
  usedAmount: string;
  usedUnit: string;
  wastePercent: string;
  showWaste: boolean;
}

const EMPTY_FORM: IngredientForm = {
  name: '',
  ingredientId: '',
  purchaseAmount: '',
  purchaseUnit: 'lb',
  purchasePrice: '',
  usedAmount: '',
  usedUnit: 'lb',
  wastePercent: '0',
  showWaste: false,
};

const ALL_UNITS = [...WEIGHT_UNITS, ...VOLUME_UNITS, ...COUNT_UNITS];

/** Get all units that can convert to/from the given unit, including cross-category if ingredient supports it */
function getAvailableUnits(unit: string, ingredientId?: string): string[] {
  return ALL_UNITS.filter((u) => canConvert(unit, u, ingredientId));
}

/** Convert usedAmount to purchaseUnit. Returns null if conversion fails. */
function convertUsedToPurchaseUnit(
  usedAmount: number,
  usedUnit: string,
  purchaseUnit: string,
  ingredientId: string,
): number | null {
  if (usedUnit === purchaseUnit) return usedAmount;

  try {
    if (getUnitCategory(usedUnit) === getUnitCategory(purchaseUnit)) {
      return convert(usedAmount, usedUnit, purchaseUnit);
    }
    return convertCrossCategory(usedAmount, usedUnit, purchaseUnit, ingredientId);
  } catch {
    return null;
  }
}

/** Calculate the cost preview for the form state */
function calculateFormCost(form: IngredientForm): number | null {
  const purchaseAmount = parseFloat(form.purchaseAmount);
  const purchasePrice = parseFloat(form.purchasePrice);
  const usedAmount = parseFloat(form.usedAmount);
  const wastePercent = parseFloat(form.wastePercent) || 0;

  if (
    isNaN(purchaseAmount) || purchaseAmount <= 0 ||
    isNaN(purchasePrice) || purchasePrice < 0 ||
    isNaN(usedAmount) || usedAmount < 0
  ) {
    return null;
  }

  const convertedUsed = convertUsedToPurchaseUnit(
    usedAmount, form.usedUnit, form.purchaseUnit, form.ingredientId,
  );
  if (convertedUsed === null) return null;

  try {
    return calculateIngredientCost({
      id: form.ingredientId || form.name,
      name: form.name,
      purchaseAmount,
      purchaseUnit: form.purchaseUnit,
      purchasePrice,
      usedAmount: convertedUsed,
      usedUnit: form.purchaseUnit,
      wastePercent,
    });
  } catch {
    return null;
  }
}

/** Check if the form has enough data to add */
function isFormComplete(form: IngredientForm): boolean {
  const purchaseAmount = parseFloat(form.purchaseAmount);
  const purchasePrice = parseFloat(form.purchasePrice);
  const usedAmount = parseFloat(form.usedAmount);

  return (
    form.name.trim().length > 0 &&
    !isNaN(purchaseAmount) && purchaseAmount > 0 &&
    !isNaN(purchasePrice) && purchasePrice >= 0 &&
    !isNaN(usedAmount) && usedAmount > 0
  );
}

/** Generate a unique ID for a new ingredient */
function generateId(): string {
  return `ing-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build an Ingredient from form data */
function formToIngredient(form: IngredientForm, existingId?: string): Ingredient {
  const usedAmount = parseFloat(form.usedAmount);
  const convertedUsed = convertUsedToPurchaseUnit(
    usedAmount, form.usedUnit, form.purchaseUnit, form.ingredientId,
  ) ?? usedAmount;

  return {
    id: existingId || generateId(),
    name: form.name.trim(),
    purchaseAmount: parseFloat(form.purchaseAmount),
    purchaseUnit: form.purchaseUnit,
    purchasePrice: parseFloat(form.purchasePrice),
    usedAmount: convertedUsed,
    usedUnit: form.purchaseUnit,
    wastePercent: parseFloat(form.wastePercent) || 0,
  };
}

/** Build a form from an existing ingredient for editing */
function ingredientToForm(ing: Ingredient): IngredientForm {
  // Check if this matches a common ingredient
  const common = COMMON_INGREDIENTS.find(
    (c) => c.name.toLowerCase() === ing.name.toLowerCase() || c.id === ing.id,
  );

  return {
    name: ing.name,
    ingredientId: common?.id || ing.id,
    purchaseAmount: String(ing.purchaseAmount),
    purchaseUnit: ing.purchaseUnit,
    purchasePrice: String(ing.purchasePrice),
    usedAmount: String(ing.usedAmount),
    usedUnit: ing.usedUnit,
    wastePercent: String(ing.wastePercent),
    showWaste: ing.wastePercent > 0,
  };
}

/** Calculate cost for a stored ingredient, returning 0 on invalid data */
function safeIngredientCost(ing: Ingredient): number {
  try {
    return calculateIngredientCost(ing);
  } catch {
    return 0;
  }
}

export default function Step2Ingredients({ recipe, onIngredientsChange, onValidChange }: Step2Props) {
  const ingredients = recipe.ingredients;

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<IngredientForm>(EMPTY_FORM);

  // Autocomplete state
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    onValidChange(ingredients.length > 0);
  }, [ingredients.length, onValidChange]);

  const filteredSuggestions = useMemo(() => {
    const query = form.name.trim().toLowerCase();
    if (query.length === 0) return [];
    return COMMON_INGREDIENTS.filter((item) =>
      item.name.toLowerCase().includes(query),
    ).slice(0, 8);
  }, [form.name]);

  const usedUnits = useMemo(() => {
    if (form.ingredientId) {
      return getAvailableUnits(form.purchaseUnit, form.ingredientId);
    }
    try {
      return getCompatibleUnits(form.purchaseUnit);
    } catch {
      return ALL_UNITS;
    }
  }, [form.purchaseUnit, form.ingredientId]);

  const costPreview = useMemo(() => calculateFormCost(form), [form]);
  const canAdd = isFormComplete(form);

  const subtotal = useMemo(() => {
    return roundCents(ingredients.reduce((sum, ing) => sum + safeIngredientCost(ing), 0));
  }, [ingredients]);

  function resetForm(open: boolean): void {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(open);
    setAutocompleteOpen(false);
    setActiveIndex(-1);
  }

  const handleOpenAdd = useCallback(() => resetForm(true), []);
  const handleCancel = useCallback(() => resetForm(false), []);

  const handleAdd = useCallback(() => {
    if (!canAdd) return;

    if (editingId) {
      const updated = ingredients.map((ing) =>
        ing.id === editingId ? formToIngredient(form, editingId) : ing,
      );
      onIngredientsChange(updated);
    } else {
      onIngredientsChange([...ingredients, formToIngredient(form)]);
    }

    resetForm(false);
  }, [canAdd, editingId, form, ingredients, onIngredientsChange]);

  const handleEdit = useCallback((ing: Ingredient) => {
    setForm(ingredientToForm(ing));
    setEditingId(ing.id);
    setShowForm(true);
    setAutocompleteOpen(false);
  }, []);

  const handleDelete = useCallback((id: string) => {
    onIngredientsChange(ingredients.filter((ing) => ing.id !== id));
  }, [ingredients, onIngredientsChange]);

  const handleNameChange = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, name: value, ingredientId: '' }));
    setAutocompleteOpen(value.trim().length > 0);
    setActiveIndex(-1);
  }, []);

  const handleSelectSuggestion = useCallback((item: CommonIngredient) => {
    setForm((prev) => ({
      ...prev,
      name: item.name,
      ingredientId: item.id,
      purchaseUnit: item.defaultPurchaseUnit,
      usedUnit: item.defaultUsedUnit,
    }));
    setAutocompleteOpen(false);
    setActiveIndex(-1);
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!autocompleteOpen || filteredSuggestions.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1,
        );
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelectSuggestion(filteredSuggestions[activeIndex]);
      } else if (e.key === 'Escape') {
        setAutocompleteOpen(false);
        setActiveIndex(-1);
      }
    },
    [autocompleteOpen, filteredSuggestions, activeIndex, handleSelectSuggestion],
  );

  const handleNameBlur = useCallback(() => {
    // Delay so click on suggestion registers first
    setTimeout(() => {
      setAutocompleteOpen(false);
      setActiveIndex(-1);
    }, 200);
  }, []);

  const handlePurchaseUnitChange = useCallback((unit: string) => {
    setForm((prev) => {
      let compatible: string[];
      if (prev.ingredientId) {
        compatible = getAvailableUnits(unit, prev.ingredientId);
      } else {
        try {
          compatible = getCompatibleUnits(unit);
        } catch {
          compatible = [unit];
        }
      }

      const usedUnit = compatible.includes(prev.usedUnit) ? prev.usedUnit : unit;
      return { ...prev, purchaseUnit: unit, usedUnit };
    });
  }, []);

  return (
    <div className="step2" data-testid="step2-ingredients">
      <div className="step2__header">
        <h2 className="step2__title">Ingredients</h2>
        <p className="step2__subtitle">
          Add each ingredient with its purchase price and amount used.
        </p>
      </div>

      {/* Ingredient list */}
      {ingredients.length > 0 ? (
        <div className="step2__list" role="list" aria-label="Ingredient list">
          {ingredients.map((ing) => {
            const cost = safeIngredientCost(ing);
            return (
              <div key={ing.id} className="step2__item" role="listitem">
                <div className="step2__item-info">
                  <div className="step2__item-name">{ing.name}</div>
                  <div className="step2__item-detail">
                    {ing.usedAmount} {ing.usedUnit} used
                    {ing.wastePercent > 0 && ` (+${ing.wastePercent}% waste)`}
                  </div>
                </div>
                <div className="step2__item-cost">{formatCurrency(cost)}</div>
                <div className="step2__item-actions">
                  <button
                    type="button"
                    className="step2__item-btn"
                    onClick={() => handleEdit(ing)}
                    aria-label={`Edit ${ing.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="step2__item-btn step2__item-btn--delete"
                    onClick={() => handleDelete(ing.id)}
                    aria-label={`Delete ${ing.name}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}

          {/* Subtotal */}
          <div className="step2__subtotal">
            <span className="step2__subtotal-label">Ingredient Total</span>
            <span className="step2__subtotal-value" data-testid="ingredient-subtotal">
              {formatCurrency(subtotal)}
            </span>
          </div>
        </div>
      ) : (
        !showForm && (
          <div className="step2__empty">
            No ingredients yet. Add your first ingredient to get started.
          </div>
        )
      )}

      {/* Inline form */}
      {showForm && (
        <div className="step2__form" data-testid="ingredient-form">
          {/* Ingredient name with autocomplete */}
          <div className="step2__field step2__field--name">
            <label className="step2__label" htmlFor="ingredient-name">
              Ingredient Name
            </label>
            <input
              id="ingredient-name"
              ref={nameInputRef}
              type="text"
              className="step2__input"
              placeholder="e.g. All-Purpose Flour"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameBlur}
              autoComplete="off"
              role="combobox"
              aria-expanded={autocompleteOpen && filteredSuggestions.length > 0}
              aria-controls="ingredient-suggestions"
              aria-activedescendant={
                activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined
              }
            />
            {autocompleteOpen && filteredSuggestions.length > 0 && (
              <ul
                id="ingredient-suggestions"
                ref={autocompleteRef}
                className="step2__autocomplete"
                role="listbox"
                aria-label="Ingredient suggestions"
              >
                {filteredSuggestions.map((item, idx) => (
                  <li
                    key={item.id}
                    id={`suggestion-${idx}`}
                    className={`step2__autocomplete-item${
                      idx === activeIndex ? ' step2__autocomplete-item--active' : ''
                    }`}
                    role="option"
                    aria-selected={idx === activeIndex}
                    onMouseDown={() => handleSelectSuggestion(item)}
                  >
                    {item.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* "I bought" row */}
          <div>
            <div className="step2__row-label">I bought</div>
            <div className="step2__form-row step2__form-row--wrap">
              <div className="step2__field step2__field--amount">
                <label className="step2__label" htmlFor="purchase-amount">
                  Amount
                </label>
                <input
                  id="purchase-amount"
                  type="number"
                  className="step2__input step2__input--mono"
                  placeholder="5"
                  min="0"
                  step="any"
                  value={form.purchaseAmount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, purchaseAmount: e.target.value }))
                  }
                />
              </div>
              <div className="step2__field step2__field--unit">
                <label className="step2__label" htmlFor="purchase-unit">
                  Unit
                </label>
                <select
                  id="purchase-unit"
                  className="step2__select"
                  value={form.purchaseUnit}
                  onChange={(e) => handlePurchaseUnitChange(e.target.value)}
                >
                  {ALL_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="step2__field step2__field--price">
                <label className="step2__label" htmlFor="purchase-price">
                  Price ($)
                </label>
                <input
                  id="purchase-price"
                  type="number"
                  className="step2__input step2__input--mono"
                  placeholder="4.99"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, purchasePrice: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          {/* "I used" row */}
          <div>
            <div className="step2__row-label">I used</div>
            <div className="step2__form-row step2__form-row--wrap">
              <div className="step2__field step2__field--amount">
                <label className="step2__label" htmlFor="used-amount">
                  Amount
                </label>
                <input
                  id="used-amount"
                  type="number"
                  className="step2__input step2__input--mono"
                  placeholder="2"
                  min="0"
                  step="any"
                  value={form.usedAmount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, usedAmount: e.target.value }))
                  }
                />
              </div>
              <div className="step2__field step2__field--unit">
                <label className="step2__label" htmlFor="used-unit">
                  Unit
                </label>
                <select
                  id="used-unit"
                  className="step2__select"
                  value={form.usedUnit}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, usedUnit: e.target.value }))
                  }
                >
                  {usedUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Waste toggle + field */}
          <div>
            {!form.showWaste ? (
              <button
                type="button"
                className="step2__waste-toggle"
                onClick={() => setForm((prev) => ({ ...prev, showWaste: true }))}
              >
                + Add waste percentage
              </button>
            ) : (
              <div className="step2__form-row">
                <div className="step2__field step2__field--waste">
                  <label className="step2__label" htmlFor="waste-percent">
                    Waste %
                  </label>
                  <input
                    id="waste-percent"
                    type="number"
                    className="step2__input step2__input--mono"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="1"
                    value={form.wastePercent}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, wastePercent: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cost preview */}
          {costPreview !== null && (
            <div className="step2__cost-preview" data-testid="cost-preview">
              Cost for this recipe: {formatCurrency(costPreview)}
            </div>
          )}

          {/* Actions */}
          <div className="step2__form-actions">
            <button
              type="button"
              className="step2__btn step2__btn--cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="step2__btn step2__btn--add"
              onClick={handleAdd}
              disabled={!canAdd}
              data-testid="add-ingredient-btn"
            >
              {editingId ? 'Save' : 'Add \u2713'}
            </button>
          </div>
        </div>
      )}

      {/* Add button (hidden when form is open) */}
      {!showForm && (
        <button
          type="button"
          className="step2__add-btn"
          onClick={handleOpenAdd}
          data-testid="open-add-form-btn"
        >
          + Add Ingredient
        </button>
      )}
    </div>
  );
}
