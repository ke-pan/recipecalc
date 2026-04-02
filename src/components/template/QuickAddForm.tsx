import { useState, useCallback, useMemo } from 'react';
import type { Ingredient, Recipe, LaborAndOverhead } from '../../lib/calc/types.js';
import type { PantryItem, UserDefaults } from '../../types/pantry.js';
import { formatCurrency } from '../../lib/format.js';
import { calculateIngredientCost, roundCents } from '../../lib/calc/pricing.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IngredientRow {
  key: string;
  pantryId: string;      // '' = manual
  name: string;
  purchaseAmount: string;
  purchaseUnit: string;
  purchasePrice: string;
  usedAmount: string;
  usedUnit: string;
  wastePercent: string;
  saveToPantry: boolean;
  ingredientKey: string;
}

interface QuickAddFormProps {
  pantry: PantryItem[];
  defaults: UserDefaults;
  onSave: (recipe: Recipe, targetCostRatio: number) => void;
  onSavePantryItem: (item: Omit<PantryItem, 'id' | 'updatedAt'>) => PantryItem | false;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyIngredientRow(): IngredientRow {
  return {
    key: crypto.randomUUID(),
    pantryId: '',
    name: '',
    purchaseAmount: '',
    purchaseUnit: 'lb',
    purchasePrice: '',
    usedAmount: '',
    usedUnit: 'lb',
    wastePercent: '0',
    saveToPantry: false,
    ingredientKey: '',
  };
}

function isPantryLinked(row: IngredientRow): boolean {
  return row.pantryId !== '' && row.pantryId !== '__manual__';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuickAddForm({ pantry, defaults, onSave, onSavePantryItem, onCancel }: QuickAddFormProps) {
  // ---- Recipe info ----
  const [name, setName] = useState('');
  const [yieldAmount, setYieldAmount] = useState('');
  const [yieldUnit, setYieldUnit] = useState('');
  const [batchTime, setBatchTime] = useState('');

  // ---- Ingredients ----
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredientRow()]);

  // ---- Labor/Overhead ----
  const [useOverride, setUseOverride] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(String(defaults.hourlyRate));
  const [packaging, setPackaging] = useState(String(defaults.packaging));
  const [overhead, setOverhead] = useState(String(defaults.overhead));
  const [platformFees, setPlatformFees] = useState(String(defaults.platformFees));

  // ---- Target cost ratio ----
  const [targetCostRatio] = useState(0.3);

  // ---- Validation ----
  const [errors, setErrors] = useState<string[]>([]);

  // Check if defaults are non-zero (so "Using your defaults" makes sense)
  const hasDefaults = defaults.hourlyRate > 0 || defaults.packaging > 0 || defaults.overhead > 0 || defaults.platformFees > 0;

  // ---- Ingredient handlers ----

  const updateIngredient = useCallback((key: string, changes: Partial<IngredientRow>) => {
    setIngredients((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }, []);

  const handlePantrySelect = useCallback(
    (key: string, pantryId: string) => {
      if (pantryId === '' || pantryId === '__manual__') {
        updateIngredient(key, {
          pantryId: pantryId === '' ? '' : '__manual__',
          name: '',
          purchaseAmount: '',
          purchaseUnit: 'lb',
          purchasePrice: '',
          ingredientKey: '',
        });
        return;
      }
      const item = pantry.find((p) => p.id === pantryId);
      if (!item) return;
      updateIngredient(key, {
        pantryId,
        name: item.name,
        purchaseAmount: String(item.purchaseAmount),
        purchaseUnit: item.purchaseUnit,
        purchasePrice: String(item.purchasePrice),
        usedUnit: item.purchaseUnit,
        ingredientKey: item.ingredientKey,
      });
    },
    [pantry, updateIngredient],
  );

  const addIngredientRow = useCallback(() => {
    setIngredients((prev) => [...prev, emptyIngredientRow()]);
  }, []);

  const removeIngredientRow = useCallback((key: string) => {
    setIngredients((prev) => {
      if (prev.length <= 1) return prev; // keep at least one row
      return prev.filter((row) => row.key !== key);
    });
  }, []);

  // ---- Computed preview ----
  const previewCost = useMemo(() => {
    let total = 0;
    for (const row of ingredients) {
      const pa = parseFloat(row.purchaseAmount);
      const pp = parseFloat(row.purchasePrice);
      const ua = parseFloat(row.usedAmount);
      const wp = parseFloat(row.wastePercent) || 0;
      if (pa > 0 && pp >= 0 && ua > 0) {
        total += roundCents(pp * (ua / pa) * (1 + wp / 100));
      }
    }
    return roundCents(total);
  }, [ingredients]);

  // ---- Save ----
  const handleSave = useCallback(() => {
    const validationErrors: string[] = [];

    if (!name.trim()) validationErrors.push('Recipe name is required.');
    const qty = parseFloat(yieldAmount);
    if (!qty || qty <= 0) validationErrors.push('Yield amount must be a positive number.');
    if (!yieldUnit.trim()) validationErrors.push('Yield unit is required.');
    const bt = parseFloat(batchTime);
    if (isNaN(bt) || bt < 0) validationErrors.push('Batch time must be a non-negative number.');

    // Validate ingredients
    const validIngredients: Ingredient[] = [];
    for (const row of ingredients) {
      if (!row.name.trim()) {
        validationErrors.push('Each ingredient must have a name.');
        continue;
      }
      const pa = parseFloat(row.purchaseAmount);
      const pp = parseFloat(row.purchasePrice);
      const ua = parseFloat(row.usedAmount);
      const wp = parseFloat(row.wastePercent) || 0;

      if (!pa || pa <= 0) { validationErrors.push(`${row.name}: purchase amount must be positive.`); continue; }
      if (isNaN(pp) || pp < 0) { validationErrors.push(`${row.name}: purchase price must be non-negative.`); continue; }
      if (!ua || ua <= 0) { validationErrors.push(`${row.name}: used amount must be positive.`); continue; }

      let pantryIdValue: string | null = null;
      if (isPantryLinked(row)) {
        pantryIdValue = row.pantryId;
      }

      // Save to pantry if checkbox is on and not already linked
      if (row.saveToPantry && !isPantryLinked(row)) {
        const newItem = onSavePantryItem({
          name: row.name.trim(),
          ingredientKey: row.ingredientKey || row.name.trim().toLowerCase().replace(/\s+/g, '-'),
          purchaseUnit: row.purchaseUnit,
          purchaseAmount: pa,
          purchasePrice: pp,
        });
        if (newItem) {
          pantryIdValue = newItem.id;
        }
      }

      validIngredients.push({
        id: crypto.randomUUID(),
        name: row.name.trim(),
        purchaseAmount: pa,
        purchaseUnit: row.purchaseUnit,
        purchasePrice: pp,
        usedAmount: ua,
        usedUnit: row.usedUnit,
        wastePercent: wp,
        pantryId: pantryIdValue,
        ingredientKey: row.ingredientKey || undefined,
      });
    }

    if (validIngredients.length === 0 && validationErrors.length === 0) {
      validationErrors.push('At least one valid ingredient is required.');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const laborAndOverhead: LaborAndOverhead = {
      hourlyRate: parseFloat(hourlyRate) || 0,
      packaging: parseFloat(packaging) || 0,
      overhead: parseFloat(overhead) || 0,
      platformFees: parseFloat(platformFees) || 0,
    };

    const recipe: Recipe = {
      name: name.trim(),
      quantity: qty,
      quantityUnit: yieldUnit.trim(),
      batchTimeHours: bt || 0,
      ingredients: validIngredients,
      laborAndOverhead,
    };

    setErrors([]);
    onSave(recipe, targetCostRatio);
  }, [
    name, yieldAmount, yieldUnit, batchTime, ingredients,
    hourlyRate, packaging, overhead, platformFees,
    targetCostRatio, onSave, onSavePantryItem,
  ]);

  // ---- Render ----
  return (
    <div className="quick-add" data-testid="quick-add-form">
      {/* ---- Recipe Info ---- */}
      <div className="quick-add__section">
        <h3 className="quick-add__section-title">Recipe Info</h3>
        <div className="quick-add__row">
          <label className="quick-add__field quick-add__field--wide">
            <span className="quick-add__label">Recipe name</span>
            <input
              type="text"
              className="quick-add__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sourdough Boule"
              data-testid="quick-add-name"
            />
          </label>
        </div>
        <div className="quick-add__row">
          <label className="quick-add__field">
            <span className="quick-add__label">Yield amount</span>
            <input
              type="number"
              className="quick-add__input mono"
              value={yieldAmount}
              onChange={(e) => setYieldAmount(e.target.value)}
              placeholder="24"
              min="0"
              step="any"
              data-testid="quick-add-yield-amount"
            />
          </label>
          <label className="quick-add__field">
            <span className="quick-add__label">Yield unit</span>
            <input
              type="text"
              className="quick-add__input"
              value={yieldUnit}
              onChange={(e) => setYieldUnit(e.target.value)}
              placeholder="cookies"
              data-testid="quick-add-yield-unit"
            />
          </label>
          <label className="quick-add__field">
            <span className="quick-add__label">Batch time (hours)</span>
            <input
              type="number"
              className="quick-add__input mono"
              value={batchTime}
              onChange={(e) => setBatchTime(e.target.value)}
              placeholder="2"
              min="0"
              step="0.25"
              data-testid="quick-add-batch-time"
            />
          </label>
        </div>
      </div>

      {/* ---- Ingredients ---- */}
      <div className="quick-add__section">
        <h3 className="quick-add__section-title">Ingredients</h3>
        {ingredients.map((row, idx) => (
          <div key={row.key} className="quick-add__ingredient" data-testid="quick-add-ingredient-row">
            {/* Pantry dropdown */}
            <div className="quick-add__ingredient-header">
              <label className="quick-add__field">
                <span className="quick-add__label">Source</span>
                <select
                  className="quick-add__select"
                  value={row.pantryId}
                  onChange={(e) => handlePantrySelect(row.key, e.target.value)}
                  data-testid="quick-add-pantry-select"
                >
                  <option value="">Select from Pantry...</option>
                  {pantry.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="__manual__">Enter manually</option>
                </select>
              </label>
              {ingredients.length > 1 && (
                <button
                  type="button"
                  className="quick-add__remove-btn"
                  onClick={() => removeIngredientRow(row.key)}
                  aria-label={`Remove ingredient ${idx + 1}`}
                  data-testid="quick-add-remove-ingredient"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Name (editable for manual, read-only for pantry-linked) */}
            <div className="quick-add__row">
              <label className="quick-add__field quick-add__field--wide">
                <span className="quick-add__label">Name</span>
                <input
                  type="text"
                  className="quick-add__input"
                  value={row.name}
                  onChange={(e) => updateIngredient(row.key, { name: e.target.value })}
                  placeholder="Ingredient name"
                  readOnly={isPantryLinked(row)}
                  data-testid="quick-add-ingredient-name"
                />
              </label>
            </div>

            {/* Purchase info */}
            <div className="quick-add__row">
              <label className="quick-add__field">
                <span className="quick-add__label">Purchase amt</span>
                <input
                  type="number"
                  className="quick-add__input mono"
                  value={row.purchaseAmount}
                  onChange={(e) => updateIngredient(row.key, { purchaseAmount: e.target.value })}
                  placeholder="5"
                  min="0"
                  step="any"
                  readOnly={isPantryLinked(row)}
                  data-testid="quick-add-purchase-amount"
                />
              </label>
              <label className="quick-add__field">
                <span className="quick-add__label">Unit</span>
                <input
                  type="text"
                  className="quick-add__input"
                  value={row.purchaseUnit}
                  onChange={(e) => updateIngredient(row.key, { purchaseUnit: e.target.value })}
                  placeholder="lb"
                  readOnly={isPantryLinked(row)}
                  data-testid="quick-add-purchase-unit"
                />
              </label>
              <label className="quick-add__field">
                <span className="quick-add__label">Price ($)</span>
                <input
                  type="number"
                  className="quick-add__input mono"
                  value={row.purchasePrice}
                  onChange={(e) => updateIngredient(row.key, { purchasePrice: e.target.value })}
                  placeholder="4.99"
                  min="0"
                  step="0.01"
                  readOnly={isPantryLinked(row)}
                  data-testid="quick-add-purchase-price"
                />
              </label>
            </div>

            {/* Usage info */}
            <div className="quick-add__row">
              <label className="quick-add__field">
                <span className="quick-add__label">Used amount</span>
                <input
                  type="number"
                  className="quick-add__input mono"
                  value={row.usedAmount}
                  onChange={(e) => updateIngredient(row.key, { usedAmount: e.target.value })}
                  placeholder="2"
                  min="0"
                  step="any"
                  data-testid="quick-add-used-amount"
                />
              </label>
              <label className="quick-add__field">
                <span className="quick-add__label">Used unit</span>
                <input
                  type="text"
                  className="quick-add__input"
                  value={row.usedUnit}
                  onChange={(e) => updateIngredient(row.key, { usedUnit: e.target.value })}
                  placeholder="lb"
                  data-testid="quick-add-used-unit"
                />
              </label>
              <label className="quick-add__field">
                <span className="quick-add__label">Waste %</span>
                <input
                  type="number"
                  className="quick-add__input mono"
                  value={row.wastePercent}
                  onChange={(e) => updateIngredient(row.key, { wastePercent: e.target.value })}
                  placeholder="0"
                  min="0"
                  max="100"
                  step="1"
                  data-testid="quick-add-waste"
                />
              </label>
            </div>

            {/* Save to Pantry checkbox (only for manual ingredients) */}
            {!isPantryLinked(row) && row.name.trim() !== '' && (
              <label className="quick-add__checkbox-row" data-testid="quick-add-save-pantry">
                <input
                  type="checkbox"
                  checked={row.saveToPantry}
                  onChange={(e) => updateIngredient(row.key, { saveToPantry: e.target.checked })}
                />
                <span className="quick-add__checkbox-label">Save to My Pantry</span>
              </label>
            )}
          </div>
        ))}

        <button
          type="button"
          className="quick-add__add-ingredient-btn"
          onClick={addIngredientRow}
          data-testid="quick-add-add-ingredient"
        >
          + Add ingredient
        </button>

        {previewCost > 0 && (
          <div className="quick-add__cost-preview mono" data-testid="quick-add-cost-preview">
            Ingredient cost: {formatCurrency(previewCost)}
          </div>
        )}
      </div>

      {/* ---- Labor / Overhead ---- */}
      <div className="quick-add__section">
        <h3 className="quick-add__section-title">Labor &amp; Overhead</h3>

        {hasDefaults && !useOverride && (
          <div className="quick-add__defaults-notice" data-testid="quick-add-defaults-notice">
            <span className="quick-add__defaults-badge">Using your defaults</span>
            <button
              type="button"
              className="quick-add__override-link"
              onClick={() => setUseOverride(true)}
              data-testid="quick-add-override-link"
            >
              Override for this recipe
            </button>
          </div>
        )}

        {(!hasDefaults || useOverride) && (
          <div className="quick-add__row" data-testid="quick-add-labor-fields">
            <label className="quick-add__field">
              <span className="quick-add__label">Hourly rate ($/hr)</span>
              <input
                type="number"
                className="quick-add__input mono"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                min="0"
                step="0.5"
                data-testid="quick-add-hourly-rate"
              />
            </label>
            <label className="quick-add__field">
              <span className="quick-add__label">Packaging ($)</span>
              <input
                type="number"
                className="quick-add__input mono"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
                min="0"
                step="0.01"
                data-testid="quick-add-packaging"
              />
            </label>
            <label className="quick-add__field">
              <span className="quick-add__label">Overhead ($)</span>
              <input
                type="number"
                className="quick-add__input mono"
                value={overhead}
                onChange={(e) => setOverhead(e.target.value)}
                min="0"
                step="0.01"
                data-testid="quick-add-overhead"
              />
            </label>
            <label className="quick-add__field">
              <span className="quick-add__label">Platform fees ($)</span>
              <input
                type="number"
                className="quick-add__input mono"
                value={platformFees}
                onChange={(e) => setPlatformFees(e.target.value)}
                min="0"
                step="0.01"
                data-testid="quick-add-platform-fees"
              />
            </label>
          </div>
        )}
      </div>

      {/* ---- Errors ---- */}
      {errors.length > 0 && (
        <div className="quick-add__errors" data-testid="quick-add-errors" role="alert">
          {errors.map((err, i) => (
            <p key={i} className="quick-add__error">{err}</p>
          ))}
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="quick-add__actions">
        <button
          type="button"
          className="template__btn"
          onClick={handleSave}
          data-testid="quick-add-save"
        >
          Save Recipe
        </button>
        <button
          type="button"
          className="template__btn template__btn--secondary"
          onClick={onCancel}
          data-testid="quick-add-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
