import { useState, useCallback } from 'react';
import { LicenseProvider, useLicense } from '../../contexts/LicenseContext.js';
import { useRecipes, type SavedRecipe } from '../../hooks/useRecipes.js';
import { calculateTotalCosts, calculatePricing } from '../../lib/calc/pricing.js';
import { formatCurrency } from '../../lib/format.js';
import { validateLicense } from '../../services/lemonsqueezy.js';
import './recipes.css';

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
  const { recipes, remove } = useRecipes();
  const [revalidating, setRevalidating] = useState(false);
  const [revalidateResult, setRevalidateResult] = useState<'success' | 'failed' | null>(null);

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

  // Gate: unlicensed users
  if (!isUnlocked) {
    return <PaywallGate />;
  }

  return (
    <div className="recipes__content">
      <div className="recipes__header">
        <h1 className="recipes__title">My Recipes</h1>
        <span className="recipes__count">
          {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
        </span>
      </div>

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
