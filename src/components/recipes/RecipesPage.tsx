import { useState, useCallback, useRef } from 'react';
import { LicenseProvider, useLicense } from '../../contexts/LicenseContext.js';
import { useRecipes, type SavedRecipe } from '../../hooks/useRecipes.js';
import { calculateTotalCosts, calculatePricing } from '../../lib/calc/pricing.js';
import { formatCurrency } from '../../lib/format.js';
import { trackEvent, EVENTS } from '../../lib/analytics.js';
import { validateLicense } from '../../services/lemonsqueezy.js';
import './recipes.css';

// ---------------------------------------------------------------------------
// Draft conflict detection helper
// ---------------------------------------------------------------------------

function hasDraftInProgress(): boolean {
  try {
    const raw = localStorage.getItem('recipecalc_current');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.recipe) return false;
    const { recipe } = data;
    return (
      (typeof recipe.name === 'string' && recipe.name.length > 0) ||
      (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recipe Card
// ---------------------------------------------------------------------------

interface RecipeCardProps {
  saved: SavedRecipe;
  onDelete: (id: string) => void;
}

function RecipeCard({ saved, onDelete }: RecipeCardProps) {
  const { recipe, targetCostRatio, savedAt, id } = saved;

  // Real-time calculation — never stored values
  const costs = calculateTotalCosts(recipe);
  const pricing = calculatePricing(costs.trueTotalCost, recipe.quantity, targetCostRatio);

  const handleEdit = () => {
    if (hasDraftInProgress()) {
      if (!window.confirm('You have unsaved changes. Load this recipe anyway?')) {
        return;
      }
    }
    window.location.href = '/calculator?edit=' + id;
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${recipe.name}"? This cannot be undone.`)) {
      onDelete(id);
    }
  };

  return (
    <article className="recipes__card" data-testid="recipe-card">
      <div className="recipes__card-header">
        <h3 className="recipes__card-name">{recipe.name}</h3>
        <span className="recipes__card-date">
          {new Date(savedAt).toLocaleDateString()}
        </span>
      </div>

      <div className="recipes__card-yield">
        {recipe.quantity} {recipe.quantityUnit}
      </div>

      <div className="recipes__card-numbers">
        <div className="recipes__card-stat">
          <span className="recipes__card-label">True Cost</span>
          <span className="recipes__card-value recipes__card-value--cost">
            {formatCurrency(costs.trueTotalCost)}
          </span>
        </div>
        <div className="recipes__card-stat">
          <span className="recipes__card-label">Sell At</span>
          <span className="recipes__card-value recipes__card-value--price">
            {formatCurrency(pricing.recommendedPricePerUnit)}
            <span className="recipes__card-unit"> /ea</span>
          </span>
        </div>
      </div>

      <div className="recipes__card-actions">
        <button
          type="button"
          className="recipes__btn recipes__btn--edit"
          onClick={handleEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="recipes__btn recipes__btn--delete"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="recipes__empty" data-testid="empty-state">
      <div className="recipes__empty-icon" aria-hidden="true">&#x1F4CB;</div>
      <h2 className="recipes__empty-title">No recipes yet</h2>
      <p className="recipes__empty-subtitle">
        Calculate your first recipe to see it here.
      </p>
      <a href="/calculator" className="recipes__btn recipes__btn--primary">
        Calculate your first recipe &rarr;
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paywall gate (unlicensed users)
// ---------------------------------------------------------------------------

function PaywallGate() {
  return (
    <div className="recipes__paywall" data-testid="paywall-gate">
      <div className="recipes__paywall-icon" aria-hidden="true">&#x1F512;</div>
      <h2 className="recipes__paywall-title">Recipe management is a paid feature</h2>
      <p className="recipes__paywall-subtitle">
        Activate your license to save, manage, and revisit your recipes.
      </p>
      <a href="/activate" className="recipes__btn recipes__btn--primary">
        Activate license &rarr;
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner component (needs LicenseContext + useRecipes)
// ---------------------------------------------------------------------------

function RecipesList() {
  const { isUnlocked, license } = useLicense();
  const { recipes, remove, exportAll, importRecipes } = useRecipes();
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateResult, setRevalidateResult] = useState<'success' | 'failed' | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRevalidate = useCallback(async () => {
    if (!license) return;
    setRevalidating(true);
    setRevalidateResult(null);
    try {
      const result = await validateLicense(license.key, license.instanceId);
      setRevalidateResult(result.ok ? 'success' : 'failed');
    } catch {
      setRevalidateResult('failed');
    } finally {
      setRevalidating(false);
    }
  }, [license]);

  const handleExport = useCallback(() => {
    const json = exportAll();
    const date = new Date().toISOString().slice(0, 10);
    const filename = `recipecalc-backup-${date}.json`;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    trackEvent(EVENTS.EXPORT_JSON);
  }, [exportAll]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          // Validate it's parseable JSON before passing to importRecipes
          JSON.parse(text);
          const result = importRecipes(text);
          setToast({
            type: 'success',
            message: `Imported ${result.added} new recipe${result.added !== 1 ? 's' : ''}, ${result.skipped} skipped (already exist)`,
          });
        } catch {
          setToast({ type: 'error', message: 'Invalid JSON file' });
        }
        // Reset input so the same file can be re-imported
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.onerror = () => {
        setToast({ type: 'error', message: 'Failed to read file' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsText(file);
    },
    [importRecipes],
  );

  // Gate: unlicensed users
  if (!isUnlocked) {
    return <PaywallGate />;
  }

  return (
    <div className="recipes__content">
      <div className="recipes__header">
        <div className="recipes__header-left">
          <h1 className="recipes__title">My Recipes</h1>
          <span className="recipes__count">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </span>
        </div>
        <div className="recipes__toolbar">
          <button
            type="button"
            className="recipes__btn recipes__btn--secondary"
            onClick={handleExport}
            data-testid="export-btn"
          >
            Export all
          </button>
          <button
            type="button"
            className="recipes__btn recipes__btn--secondary"
            onClick={handleImportClick}
            data-testid="import-btn"
          >
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="recipes__file-input"
            data-testid="import-file-input"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </div>

      {toast && (
        <div
          className={`recipes__toast recipes__toast--${toast.type}`}
          data-testid="import-toast"
          role="status"
        >
          <span>{toast.message}</span>
          <button
            type="button"
            className="recipes__toast-dismiss"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      {recipes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="recipes__grid" data-testid="recipe-list">
          {recipes.map((saved) => (
            <RecipeCard key={saved.id} saved={saved} onDelete={remove} />
          ))}
        </div>
      )}

      <div className="recipes__footer">
        <button
          type="button"
          className="recipes__btn recipes__btn--secondary"
          onClick={handleRevalidate}
          disabled={revalidating}
          data-testid="revalidate-btn"
        >
          {revalidating ? 'Checking...' : 'Re-validate license'}
        </button>
        {revalidateResult === 'success' && (
          <span className="recipes__revalidate-status recipes__revalidate-status--ok" data-testid="revalidate-success">
            License valid
          </span>
        )}
        {revalidateResult === 'failed' && (
          <span className="recipes__revalidate-status recipes__revalidate-status--fail" data-testid="revalidate-failed">
            Validation failed
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps with LicenseProvider
// ---------------------------------------------------------------------------

export default function RecipesPage() {
  return (
    <LicenseProvider>
      <div className="recipes">
        <nav className="recipes__nav">
          <a href="/" className="recipes__logo">RecipeCalc</a>
          <a href="/calculator" className="recipes__nav-link">Calculator</a>
        </nav>
        <RecipesList />
      </div>
    </LicenseProvider>
  );
}
