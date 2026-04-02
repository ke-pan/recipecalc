import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { LicenseProvider, useLicense } from '../../contexts/LicenseContext.js';
import { useRecipes, type SavedRecipe } from '../../hooks/useRecipes.js';
import { usePantry } from '../../hooks/usePantry.js';
import { hydrateRecipe, type HydrationWarningType } from '../../lib/pantry/hydrate.js';
import { calculateTotalCosts, calculateIngredientCost, calculatePricing } from '../../lib/calc/pricing.js';
import { formatCurrency } from '../../lib/format.js';
import type { Ingredient } from '../../lib/calc/types.js';
import type { PantryItem } from '../../types/pantry.js';
import './template.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComputedRecipe {
  saved: SavedRecipe;
  ingredientCost: number;
  laborCost: number;
  trueTotalCost: number;
  recommendedPricePerUnit: number;
  warnings: Array<{ ingredientName: string; warning: HydrationWarningType }>;
}

// ---------------------------------------------------------------------------
// Warning icon component
// ---------------------------------------------------------------------------

function WarningIcon({ warning }: { warning: HydrationWarningType }) {
  const title =
    warning === 'pantry_deleted'
      ? 'Pantry item deleted — using saved price'
      : 'Unit incompatible — using saved price';

  return (
    <span
      className="template__warning-icon"
      title={title}
      aria-label={title}
      role="img"
    >
      &#x26A0;
    </span>
  );
}

// ---------------------------------------------------------------------------
// Name similarity scoring (simple word-overlap heuristic)
// ---------------------------------------------------------------------------

/**
 * Score how similar two ingredient names are.
 * Higher is more similar. Exact match = 1000, word overlap gets partial credit.
 */
function nameSimilarity(ingredientName: string, pantryName: string): number {
  const a = ingredientName.toLowerCase().trim();
  const b = pantryName.toLowerCase().trim();

  // Exact match
  if (a === b) return 1000;

  // Substring match
  if (b.includes(a) || a.includes(b)) return 500;

  // Word overlap
  const wordsA = a.split(/\s+/);
  const wordsB = new Set(b.split(/\s+/));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  return overlap * 100;
}

// ---------------------------------------------------------------------------
// Pantry link dropdown
// ---------------------------------------------------------------------------

interface PantryLinkDropdownProps {
  ingredientName: string;
  pantry: PantryItem[];
  onSelect: (pantryItem: PantryItem) => void;
  onClose: () => void;
}

function PantryLinkDropdown({ ingredientName, pantry, onSelect, onClose }: PantryLinkDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Sort pantry items by name similarity to the ingredient
  const sorted = useMemo(() => {
    return [...pantry].sort((a, b) => {
      const scoreA = nameSimilarity(ingredientName, a.name);
      const scoreB = nameSimilarity(ingredientName, b.name);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    });
  }, [pantry, ingredientName]);

  if (pantry.length === 0) {
    return (
      <div className="template__link-dropdown" ref={dropdownRef} data-testid="pantry-link-dropdown">
        <div className="template__link-dropdown-empty">
          No pantry items yet.{' '}
          <a href="/pantry">Add some &rarr;</a>
        </div>
      </div>
    );
  }

  return (
    <div className="template__link-dropdown" ref={dropdownRef} data-testid="pantry-link-dropdown">
      <div className="template__link-dropdown-header">Link to Pantry</div>
      <ul className="template__link-dropdown-list" role="listbox" aria-label="Pantry items">
        {sorted.map((item) => (
          <li key={item.id} role="option">
            <button
              type="button"
              className="template__link-dropdown-item"
              onClick={() => onSelect(item)}
              data-testid={`pantry-option-${item.id}`}
            >
              <span className="template__link-dropdown-name">{item.name}</span>
              <span className="template__link-dropdown-price mono">
                {formatCurrency(item.purchasePrice)}/{item.purchaseAmount}{item.purchaseUnit}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ingredient detail row (expanded view)
// ---------------------------------------------------------------------------

interface IngredientRowProps {
  name: string;
  ingredientId: string;
  usedAmount: number;
  usedUnit: string;
  cost: number;
  pantryId?: string | null;
  warning?: HydrationWarningType;
  pantry: PantryItem[];
  onLink: (ingredientId: string, pantryItem: PantryItem) => void;
  onUnlink: (ingredientId: string) => void;
}

function IngredientRow({ name, ingredientId, usedAmount, usedUnit, cost, pantryId, warning, pantry, onLink, onUnlink }: IngredientRowProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const pantryItem = pantryId ? pantry.find((p) => p.id === pantryId) : undefined;
  const isLinked = !!pantryId && !!pantryItem;

  const handleSelect = useCallback((item: PantryItem) => {
    onLink(ingredientId, item);
    setShowDropdown(false);
  }, [ingredientId, onLink]);

  const handleUnlink = useCallback(() => {
    onUnlink(ingredientId);
  }, [ingredientId, onUnlink]);

  return (
    <tr className="template__ingredient-row">
      <td className="template__ingredient-name">
        {name}
        {warning && <WarningIcon warning={warning} />}
      </td>
      <td className="template__ingredient-amount mono">
        {usedAmount} {usedUnit}
      </td>
      <td className="template__ingredient-cost mono">{formatCurrency(cost)}</td>
      <td className="template__ingredient-pantry">
        {isLinked ? (
          <span className="template__pantry-badge-group">
            <span className="template__pantry-linked" title={`Linked to: ${pantryItem.name}`}>
              Pantry
            </span>
            <button
              type="button"
              className="template__unlink-btn"
              onClick={handleUnlink}
              title="Unlink from Pantry"
              aria-label={`Unlink ${name} from Pantry`}
            >
              &times;
            </button>
          </span>
        ) : (
          <span className="template__link-cell">
            <button
              type="button"
              className="template__link-btn"
              onClick={() => setShowDropdown(!showDropdown)}
              title="Link to Pantry item"
              aria-label={`Link ${name} to Pantry`}
              data-testid={`link-btn-${ingredientId}`}
            >
              &#x1F517; Link
            </button>
            {showDropdown && (
              <PantryLinkDropdown
                ingredientName={name}
                pantry={pantry}
                onSelect={handleSelect}
                onClose={() => setShowDropdown(false)}
              />
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  recipeName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteDialog({ recipeName, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <div className="template__dialog-overlay" data-testid="delete-dialog">
      <div className="template__dialog" role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-desc">
        <h3 id="delete-title" className="template__dialog-title">Delete recipe?</h3>
        <p id="delete-desc" className="template__dialog-desc">
          Are you sure you want to delete <strong>{recipeName}</strong>? This cannot be undone.
        </p>
        <div className="template__dialog-actions">
          <button
            type="button"
            className="template__btn template__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="template__btn template__btn--danger"
            onClick={onConfirm}
            data-testid="confirm-delete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recipe table row (with expansion)
// ---------------------------------------------------------------------------

interface RecipeRowProps {
  computed: ComputedRecipe;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
  onLinkIngredient: (recipeId: string, ingredientId: string, pantryItem: PantryItem) => void;
  onUnlinkIngredient: (recipeId: string, ingredientId: string) => void;
  pantry: PantryItem[];
}

function RecipeRow({ computed, isExpanded, onToggle, onDelete, onLinkIngredient, onUnlinkIngredient, pantry }: RecipeRowProps) {
  const { saved, ingredientCost, laborCost, trueTotalCost, recommendedPricePerUnit, warnings } = computed;
  const { recipe } = saved;

  // Build a map of ingredientName -> warning for quick lookup
  const warningMap = useMemo(() => {
    const map = new Map<string, HydrationWarningType>();
    for (const w of warnings) {
      map.set(w.ingredientName, w.warning);
    }
    return map;
  }, [warnings]);

  return (
    <>
      <tr className={`template__recipe-row ${isExpanded ? 'template__recipe-row--expanded' : ''}`}>
        <td className="template__recipe-name">
          <button
            type="button"
            className="template__expand-btn"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${recipe.name}`}
          >
            <span className="template__expand-arrow" aria-hidden="true">
              {isExpanded ? '\u25BC' : '\u25B6'}
            </span>
            {recipe.name}
            {warnings.length > 0 && (
              <span className="template__row-warning-count" title={`${warnings.length} warning(s)`}>
                &#x26A0; {warnings.length}
              </span>
            )}
          </button>
        </td>
        <td className="template__recipe-yield mono">
          {recipe.quantity} {recipe.quantityUnit}
        </td>
        <td className="template__recipe-cost mono">{formatCurrency(ingredientCost)}</td>
        <td className="template__recipe-labor mono">{formatCurrency(laborCost)}</td>
        <td className="template__recipe-total mono">{formatCurrency(trueTotalCost)}</td>
        <td className="template__recipe-price mono template__confidence">
          {formatCurrency(recommendedPricePerUnit)}/ea
        </td>
        <td className="template__recipe-actions">
          <a
            href={`/calculator?edit=${saved.id}`}
            className="template__action-btn"
            title="Edit recipe"
            aria-label={`Edit ${recipe.name}`}
          >
            Edit
          </a>
          <button
            type="button"
            className="template__action-btn template__action-btn--delete"
            onClick={() => onDelete(saved.id)}
            title="Delete recipe"
            aria-label={`Delete ${recipe.name}`}
          >
            Delete
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="template__expanded-row">
          <td colSpan={7}>
            <table className="template__ingredient-table" aria-label={`Ingredients for ${recipe.name}`}>
              <thead>
                <tr>
                  <th>Ingredient</th>
                  <th>Amount</th>
                  <th>Cost</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ing) => (
                  <IngredientRow
                    key={ing.id}
                    name={ing.name}
                    ingredientId={ing.id}
                    usedAmount={ing.usedAmount}
                    usedUnit={ing.usedUnit}
                    cost={calculateIngredientCost(ing)}
                    pantryId={ing.pantryId}
                    warning={warningMap.get(ing.name)}
                    pantry={pantry}
                    onLink={(ingredientId, pantryItem) => onLinkIngredient(saved.id, ingredientId, pantryItem)}
                    onUnlink={(ingredientId) => onUnlinkIngredient(saved.id, ingredientId)}
                  />
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Inner component (needs LicenseContext)
// ---------------------------------------------------------------------------

function TemplateContent() {
  const { isUnlocked } = useLicense();
  const { recipes, remove, update, exportAll, importRecipes } = useRecipes();
  const { pantry } = usePantry();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Redirect to /activate if not unlocked
  if (!isUnlocked) {
    if (typeof window !== 'undefined') {
      window.location.href = '/activate';
    }
    return null;
  }

  // Compute costs for all recipes via hydration
  const computedRecipes: ComputedRecipe[] = useMemo(() => {
    return recipes.map((saved) => {
      const { recipe: hydratedRecipe, warnings } = hydrateRecipe(saved.recipe, pantry);
      const costs = calculateTotalCosts(hydratedRecipe);
      const pricing = calculatePricing(costs.trueTotalCost, hydratedRecipe.quantity, saved.targetCostRatio);

      return {
        saved: { ...saved, recipe: hydratedRecipe },
        ingredientCost: costs.ingredientCost,
        laborCost: costs.laborCost,
        trueTotalCost: costs.trueTotalCost,
        recommendedPricePerUnit: pricing.recommendedPricePerUnit,
        warnings,
      };
    });
  }, [recipes, pantry]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleDeleteRequest = useCallback((id: string) => {
    const recipe = recipes.find((r) => r.id === id);
    if (recipe) {
      setDeleteTarget({ id, name: recipe.recipe.name });
    }
  }, [recipes]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      remove(deleteTarget.id);
      setDeleteTarget(null);
      // Collapse if the deleted row was expanded
      setExpandedId((prev) => (prev === deleteTarget.id ? null : prev));
    }
  }, [deleteTarget, remove]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleLinkIngredient = useCallback((recipeId: string, ingredientId: string, pantryItem: PantryItem) => {
    const saved = recipes.find((r) => r.id === recipeId);
    if (!saved) return;

    const updatedIngredients: Ingredient[] = saved.recipe.ingredients.map((ing) =>
      ing.id === ingredientId
        ? { ...ing, pantryId: pantryItem.id, ingredientKey: pantryItem.ingredientKey }
        : ing,
    );

    const updatedRecipe = { ...saved.recipe, ingredients: updatedIngredients };
    update(recipeId, updatedRecipe, saved.targetCostRatio);
  }, [recipes, update]);

  const handleUnlinkIngredient = useCallback((recipeId: string, ingredientId: string) => {
    const saved = recipes.find((r) => r.id === recipeId);
    if (!saved) return;

    const updatedIngredients: Ingredient[] = saved.recipe.ingredients.map((ing) =>
      ing.id === ingredientId
        ? { ...ing, pantryId: null, ingredientKey: undefined }
        : ing,
    );

    const updatedRecipe = { ...saved.recipe, ingredients: updatedIngredients };
    update(recipeId, updatedRecipe, saved.targetCostRatio);
  }, [recipes, update]);

  const handleExport = useCallback(() => {
    const json = exportAll();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recipecalc-recipes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportAll]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const json = reader.result as string;
        importRecipes(json);
      };
      reader.readAsText(file);
    };
    input.click();
  }, [importRecipes]);

  return (
    <div className="template">
      <div className="template__container">
        {/* Header */}
        <header className="template__header">
          <h1 className="template__title">Recipes</h1>
          <a href="/" className="template__logo">RecipeCalc</a>
        </header>

        {/* Toolbar */}
        <div className="template__toolbar">
          <span className="template__count" data-testid="recipe-count">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </span>
          <div className="template__toolbar-actions">
            <a href="/pantry" className="template__toolbar-link">
              Go to Pantry
            </a>
            <button type="button" className="template__btn template__btn--secondary" onClick={handleExport}>
              Export
            </button>
            <button type="button" className="template__btn template__btn--secondary" onClick={handleImport}>
              Import
            </button>
          </div>
        </div>

        {/* Table or empty state */}
        {recipes.length === 0 ? (
          <div className="template__empty" data-testid="empty-state">
            <p className="template__empty-text">No recipes yet.</p>
            <a href="/calculator" className="template__btn">
              Create your first recipe &rarr;
            </a>
          </div>
        ) : (
          <div className="template__table-wrap">
            <table className="template__table" aria-label="Recipe list">
              <thead>
                <tr>
                  <th className="template__th">Recipe</th>
                  <th className="template__th">Yield</th>
                  <th className="template__th">Ingredients</th>
                  <th className="template__th">Labor</th>
                  <th className="template__th">Total Cost</th>
                  <th className="template__th">Rec. Price</th>
                  <th className="template__th template__th--actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {computedRecipes.map((computed) => (
                  <RecipeRow
                    key={computed.saved.id}
                    computed={computed}
                    isExpanded={expandedId === computed.saved.id}
                    onToggle={() => handleToggle(computed.saved.id)}
                    onDelete={handleDeleteRequest}
                    onLinkIngredient={handleLinkIngredient}
                    onUnlinkIngredient={handleUnlinkIngredient}
                    pantry={pantry}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteTarget && (
          <DeleteDialog
            recipeName={deleteTarget.name}
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps with LicenseProvider
// ---------------------------------------------------------------------------

export default function TemplatePage() {
  return (
    <LicenseProvider>
      <TemplateContent />
    </LicenseProvider>
  );
}
