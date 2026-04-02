import { useState, useCallback, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react';
import { LicenseProvider, useLicense } from '../../contexts/LicenseContext.js';
import { usePantry } from '../../hooks/usePantry.js';
import { useDefaults } from '../../hooks/useDefaults.js';
import { WEIGHT_UNITS, VOLUME_UNITS, COUNT_UNITS } from '../../lib/units/conversion-factors.js';
import { formatCurrency } from '../../lib/format.js';
import type { PantryItem } from '../../types/pantry.js';
import type { UserDefaults } from '../../types/pantry.js';
import './pantry.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_UNITS = [...WEIGHT_UNITS, ...VOLUME_UNITS, ...COUNT_UNITS];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function computeUnitPrice(price: number, amount: number): number {
  if (amount <= 0) return 0;
  return price / amount;
}

// ---------------------------------------------------------------------------
// EditableCell — inline editing for text and number fields
// ---------------------------------------------------------------------------

interface EditableCellProps {
  value: string | number;
  type: 'text' | 'number';
  onSave: (value: string | number) => void;
  className?: string;
  ariaLabel: string;
  testId?: string;
}

function EditableCell({ value, type, onSave, className = '', ariaLabel, testId }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync draft with external value changes
  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (type === 'number') {
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num >= 0 && num !== value) {
        onSave(num);
      }
    } else {
      if (trimmed && trimmed !== value) {
        onSave(trimmed);
      }
    }
  }, [draft, type, value, onSave]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit();
      } else if (e.key === 'Escape') {
        setDraft(String(value));
        setEditing(false);
      }
    },
    [commit, value],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`pantry__cell-input ${className}`}
        type={type}
        value={draft}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        data-testid={testId}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? 'any' : undefined}
      />
    );
  }

  return (
    <span
      className={`pantry__cell-value ${className}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${ariaLabel} (click to edit)`}
      data-testid={testId}
    >
      {type === 'number' ? formatCurrency(Number(value)) : value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// UnitDropdown
// ---------------------------------------------------------------------------

interface UnitDropdownProps {
  value: string;
  onChange: (unit: string) => void;
  ariaLabel: string;
}

function UnitDropdown({ value, onChange, ariaLabel }: UnitDropdownProps) {
  return (
    <select
      className="pantry__unit-select"
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      aria-label={ariaLabel}
    >
      <optgroup label="Weight">
        {WEIGHT_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </optgroup>
      <optgroup label="Volume">
        {VOLUME_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </optgroup>
      <optgroup label="Count">
        {COUNT_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
// ---------------------------------------------------------------------------

interface DeleteConfirmDialogProps {
  ingredientName: string;
  recipeCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmDialog({ ingredientName, recipeCount, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="pantry__dialog-overlay" data-testid="delete-confirm-dialog">
      <div className="pantry__dialog" role="alertdialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-desc">
        <h3 id="delete-dialog-title" className="pantry__dialog-title">
          Delete "{ingredientName}"?
        </h3>
        <p id="delete-dialog-desc" className="pantry__dialog-desc">
          This ingredient is used in {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}.
          Deleting it will remove the saved price for those recipes.
        </p>
        <div className="pantry__dialog-actions">
          <button
            type="button"
            className="pantry__btn pantry__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pantry__btn pantry__btn--danger"
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
// AddIngredientRow
// ---------------------------------------------------------------------------

interface AddRowState {
  name: string;
  purchaseAmount: string;
  purchaseUnit: string;
  purchasePrice: string;
}

const EMPTY_ADD_ROW: AddRowState = {
  name: '',
  purchaseAmount: '1',
  purchaseUnit: 'lb',
  purchasePrice: '',
};

interface AddIngredientRowProps {
  onAdd: (item: Omit<PantryItem, 'id' | 'updatedAt'>) => PantryItem | false;
  onError: (msg: string) => void;
}

function AddIngredientRow({ onAdd, onError }: AddIngredientRowProps) {
  const [form, setForm] = useState<AddRowState>(EMPTY_ADD_ROW);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const name = form.name.trim();
    if (!name) {
      onError('Ingredient name is required.');
      return;
    }

    const amount = parseFloat(form.purchaseAmount);
    const price = parseFloat(form.purchasePrice);
    if (isNaN(amount) || amount <= 0) {
      onError('Purchase amount must be greater than 0.');
      return;
    }
    if (isNaN(price) || price < 0) {
      onError('Purchase price must be 0 or greater.');
      return;
    }

    // Generate ingredientKey from name (lowercase, spaces to hyphens)
    const ingredientKey = name.toLowerCase().replace(/\s+/g, '-');

    const result = onAdd({
      name,
      ingredientKey,
      purchaseUnit: form.purchaseUnit,
      purchaseAmount: amount,
      purchasePrice: price,
    });

    if (result === false) {
      onError(`An ingredient named "${name}" already exists.`);
      return;
    }

    setForm(EMPTY_ADD_ROW);
    nameInputRef.current?.focus();
  }, [form, onAdd, onError]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleAdd();
      }
    },
    [handleAdd],
  );

  return (
    <div className="pantry__add-row" data-testid="add-ingredient-row">
      <input
        ref={nameInputRef}
        className="pantry__add-input pantry__add-input--name"
        type="text"
        placeholder="Ingredient name"
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        onKeyDown={handleKeyDown}
        aria-label="New ingredient name"
        data-testid="add-name-input"
      />
      <input
        className="pantry__add-input pantry__add-input--amount"
        type="number"
        placeholder="Qty"
        value={form.purchaseAmount}
        onChange={(e) => setForm((prev) => ({ ...prev, purchaseAmount: e.target.value }))}
        onKeyDown={handleKeyDown}
        aria-label="Purchase amount"
        min="0"
        step="any"
        data-testid="add-amount-input"
      />
      <select
        className="pantry__unit-select"
        value={form.purchaseUnit}
        onChange={(e) => setForm((prev) => ({ ...prev, purchaseUnit: e.target.value }))}
        aria-label="Purchase unit"
        data-testid="add-unit-select"
      >
        <optgroup label="Weight">
          {WEIGHT_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </optgroup>
        <optgroup label="Volume">
          {VOLUME_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </optgroup>
        <optgroup label="Count">
          {COUNT_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </optgroup>
      </select>
      <input
        className="pantry__add-input pantry__add-input--price"
        type="number"
        placeholder="Price"
        value={form.purchasePrice}
        onChange={(e) => setForm((prev) => ({ ...prev, purchasePrice: e.target.value }))}
        onKeyDown={handleKeyDown}
        aria-label="Purchase price"
        min="0"
        step="any"
        data-testid="add-price-input"
      />
      <button
        type="button"
        className="pantry__btn pantry__btn--add"
        onClick={handleAdd}
        data-testid="add-ingredient-btn"
      >
        Add
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PantryTableRow
// ---------------------------------------------------------------------------

interface PantryTableRowProps {
  item: PantryItem;
  onUpdate: (id: string, changes: Partial<Omit<PantryItem, 'id' | 'updatedAt'>>) => boolean;
  onDelete: (item: PantryItem) => void;
  onError: (msg: string) => void;
}

function PantryTableRow({ item, onUpdate, onDelete, onError }: PantryTableRowProps) {
  const unitPrice = computeUnitPrice(item.purchasePrice, item.purchaseAmount);

  const handleSave = useCallback(
    (field: keyof Omit<PantryItem, 'id' | 'updatedAt'>, value: string | number) => {
      const success = onUpdate(item.id, { [field]: value });
      if (!success && field === 'name') {
        onError(`An ingredient named "${value}" already exists.`);
      }
    },
    [item.id, onUpdate, onError],
  );

  return (
    <tr className="pantry__row" data-testid={`pantry-row-${item.id}`}>
      <td className="pantry__cell pantry__cell--name">
        <EditableCell
          value={item.name}
          type="text"
          onSave={(v) => handleSave('name', v)}
          ariaLabel={`Name: ${item.name}`}
          testId={`name-${item.id}`}
        />
      </td>
      <td className="pantry__cell pantry__cell--amount">
        <EditableCell
          value={item.purchaseAmount}
          type="number"
          onSave={(v) => handleSave('purchaseAmount', v)}
          className="mono"
          ariaLabel={`Amount: ${item.purchaseAmount}`}
          testId={`amount-${item.id}`}
        />
      </td>
      <td className="pantry__cell pantry__cell--unit">
        <UnitDropdown
          value={item.purchaseUnit}
          onChange={(v) => handleSave('purchaseUnit', v)}
          ariaLabel={`Unit for ${item.name}`}
        />
      </td>
      <td className="pantry__cell pantry__cell--price">
        <EditableCell
          value={item.purchasePrice}
          type="number"
          onSave={(v) => handleSave('purchasePrice', v)}
          className="mono"
          ariaLabel={`Price: ${item.purchasePrice}`}
          testId={`price-${item.id}`}
        />
      </td>
      <td className="pantry__cell pantry__cell--unit-price mono" data-testid={`unit-price-${item.id}`}>
        {formatCurrency(unitPrice)}/{item.purchaseUnit}
      </td>
      <td className="pantry__cell pantry__cell--updated">
        {formatDate(item.updatedAt)}
      </td>
      <td className="pantry__cell pantry__cell--actions">
        <button
          type="button"
          className="pantry__delete-btn"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.name}`}
          data-testid={`delete-${item.id}`}
        >
          &#x2715;
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// DefaultCard — inline-editable card for a single default value
// ---------------------------------------------------------------------------

interface DefaultCardProps {
  label: string;
  suffix: string;
  value: number;
  field: keyof UserDefaults;
  onUpdate: (changes: Partial<UserDefaults>) => void;
  testId: string;
}

function DefaultCard({ label, suffix, value, field, onUpdate, testId }: DefaultCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const num = parseFloat(draft.trim());
    if (!isNaN(num) && num >= 0 && num !== value) {
      onUpdate({ [field]: num });
    }
  }, [draft, value, field, onUpdate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit();
      } else if (e.key === 'Escape') {
        setDraft(String(value));
        setEditing(false);
      }
    },
    [commit, value],
  );

  return (
    <div className="defaults__card" data-testid={testId}>
      <span className="defaults__card-label">{label}</span>
      {editing ? (
        <input
          ref={inputRef}
          className="defaults__card-input"
          type="number"
          value={draft}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          aria-label={label}
          data-testid={`${testId}-input`}
          min="0"
          step="any"
        />
      ) : (
        <span
          className="defaults__card-value"
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${label} (click to edit)`}
          data-testid={`${testId}-value`}
        >
          {formatCurrency(value)}
        </span>
      )}
      <span className="defaults__card-suffix">{suffix}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MyDefaults — section showing 4 default value cards
// ---------------------------------------------------------------------------

interface MyDefaultsProps {
  defaults: UserDefaults;
  onUpdate: (changes: Partial<UserDefaults>) => void;
}

function MyDefaults({ defaults, onUpdate }: MyDefaultsProps) {
  return (
    <section className="defaults" data-testid="my-defaults" aria-labelledby="defaults-heading">
      <h2 id="defaults-heading" className="defaults__heading">My Defaults</h2>
      <p className="defaults__hint">
        Used by Calculator and Quick Add. Each recipe can override.
      </p>
      <div className="defaults__grid">
        <DefaultCard
          label="Hourly Rate"
          suffix="$/hr"
          value={defaults.hourlyRate}
          field="hourlyRate"
          onUpdate={onUpdate}
          testId="default-hourly-rate"
        />
        <DefaultCard
          label="Packaging"
          suffix="$/batch"
          value={defaults.packaging}
          field="packaging"
          onUpdate={onUpdate}
          testId="default-packaging"
        />
        <DefaultCard
          label="Overhead"
          suffix="$/batch"
          value={defaults.overhead}
          field="overhead"
          onUpdate={onUpdate}
          testId="default-overhead"
        />
        <DefaultCard
          label="Platform Fees"
          suffix="$/batch"
          value={defaults.platformFees}
          field="platformFees"
          onUpdate={onUpdate}
          testId="default-platform-fees"
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// PantryContent — main content (needs LicenseContext + usePantry)
// ---------------------------------------------------------------------------

function PantryContent() {
  const { isUnlocked } = useLicense();
  const { pantry, add, update, remove, getReferencingRecipeCount } = usePantry();
  const { defaults, update: updateDefaults } = useDefaults();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PantryItem | null>(null);
  const [deleteRefCount, setDeleteRefCount] = useState(0);

  // Redirect unpaid users
  useEffect(() => {
    if (!isUnlocked) {
      window.location.href = '/activate';
    }
  }, [isUnlocked]);

  // Filter pantry by search
  const filtered = search.trim()
    ? pantry.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()),
      )
    : pantry;

  const handleError = useCallback((msg: string) => {
    setError(msg);
    // Auto-clear after 4 seconds
    setTimeout(() => setError(null), 4000);
  }, []);

  const handleDelete = useCallback(
    (item: PantryItem) => {
      const refCount = getReferencingRecipeCount(item.id);
      if (refCount > 0) {
        setDeleteTarget(item);
        setDeleteRefCount(refCount);
      } else {
        remove(item.id);
      }
    },
    [getReferencingRecipeCount, remove],
  );

  const confirmDelete = useCallback(() => {
    if (deleteTarget) {
      remove(deleteTarget.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, remove]);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // Don't render content for unpaid users (they'll be redirected)
  if (!isUnlocked) {
    return null;
  }

  return (
    <div className="pantry">
      <div className="pantry__container">
        {/* Header */}
        <div className="pantry__header">
          <div className="pantry__header-top">
            <a href="/" className="pantry__logo">RecipePricer</a>
            <nav className="pantry__nav">
              <a href="/calculator" className="pantry__nav-link">Calculator</a>
            </nav>
          </div>
          <h1 className="pantry__title">Your Pantry</h1>
          <p className="pantry__subtitle">
            Manage ingredient prices. Update once, every recipe updates automatically.
          </p>
        </div>

        {/* Error toast */}
        {error && (
          <div className="pantry__error" role="alert" data-testid="pantry-error">
            {error}
          </div>
        )}

        {/* Search + Add row */}
        <div className="pantry__toolbar">
          <input
            className="pantry__search"
            type="text"
            placeholder="Search ingredients..."
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            aria-label="Search ingredients"
            data-testid="pantry-search"
          />
        </div>

        <AddIngredientRow onAdd={add} onError={handleError} />

        {/* Table or empty state */}
        {pantry.length === 0 ? (
          <div className="pantry__empty" data-testid="pantry-empty">
            <p className="pantry__empty-text">
              No ingredients yet. Add your first ingredient above.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="pantry__empty" data-testid="pantry-no-results">
            <p className="pantry__empty-text">
              No ingredients match "{search}".
            </p>
          </div>
        ) : (
          <div className="pantry__table-wrapper" tabIndex={0} role="region" aria-label="Pantry ingredients table">
            <table className="pantry__table" data-testid="pantry-table" aria-label="Pantry ingredients">
              <thead>
                <tr>
                  <th className="pantry__th" scope="col">Name</th>
                  <th className="pantry__th" scope="col">Amount</th>
                  <th className="pantry__th" scope="col">Unit</th>
                  <th className="pantry__th" scope="col">Price</th>
                  <th className="pantry__th" scope="col">Unit Price</th>
                  <th className="pantry__th" scope="col">Updated</th>
                  <th className="pantry__th pantry__th--actions" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <PantryTableRow
                    key={item.id}
                    item={item}
                    onUpdate={update}
                    onDelete={handleDelete}
                    onError={handleError}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete confirmation dialog */}
        {deleteTarget && (
          <DeleteConfirmDialog
            ingredientName={deleteTarget.name}
            recipeCount={deleteRefCount}
            onConfirm={confirmDelete}
            onCancel={cancelDelete}
          />
        )}

        {/* My Defaults */}
        <MyDefaults defaults={defaults} onUpdate={updateDefaults} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported component — wraps with LicenseProvider
// ---------------------------------------------------------------------------

export default function PantryPage() {
  return (
    <LicenseProvider>
      <PantryContent />
    </LicenseProvider>
  );
}
