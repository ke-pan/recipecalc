import { useState, useCallback, useEffect, useRef } from 'react';
import type { Recipe } from '../../../lib/calc/types';
import './step1.css';

interface Step1Props {
  recipe: Recipe;
  onUpdate: (
    data: Partial<Pick<Recipe, 'name' | 'quantity' | 'quantityUnit' | 'batchTimeHours'>>,
  ) => void;
  onValidChange: (valid: boolean) => void;
}

interface FieldErrors {
  name?: string;
  quantity?: string;
  batchTimeHours?: string;
}

function validate(
  name: string,
  quantity: number,
  batchTimeHours: number,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) {
    errors.name = 'Please name your recipe.';
  }
  if (!quantity || quantity <= 0) {
    errors.quantity = 'Quantity must be greater than zero.';
  }
  if (batchTimeHours < 0) {
    errors.batchTimeHours = 'Time cannot be negative.';
  }
  return errors;
}

export default function Step1RecipeInfo({
  recipe,
  onUpdate,
  onValidChange,
}: Step1Props) {
  const [name, setName] = useState(recipe.name);
  const [quantity, setQuantity] = useState(recipe.quantity);
  const [quantityUnit, setQuantityUnit] = useState(recipe.quantityUnit);
  const [batchTimeHours, setBatchTimeHours] = useState(recipe.batchTimeHours);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState(false);

  // Track whether onValidChange has been called to avoid stale closure issues
  const lastValidRef = useRef<boolean | null>(null);

  // Run validation and notify parent whenever values change
  useEffect(() => {
    const fieldErrors = validate(name, quantity, batchTimeHours);
    const isValid = Object.keys(fieldErrors).length === 0;

    // Only notify if validity changed
    if (lastValidRef.current !== isValid) {
      lastValidRef.current = isValid;
      onValidChange(isValid);
    }

    // Update inline errors only after the user has attempted to submit / blurred
    if (touched) {
      setErrors(fieldErrors);
    }
  }, [name, quantity, batchTimeHours, touched, onValidChange]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setName(value);
      onUpdate({ name: value });
    },
    [onUpdate],
  );

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.valueAsNumber || 0;
      setQuantity(value);
      onUpdate({ quantity: value });
    },
    [onUpdate],
  );

  const handleUnitChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuantityUnit(value);
      onUpdate({ quantityUnit: value });
    },
    [onUpdate],
  );

  const handleTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.valueAsNumber || 0;
      setBatchTimeHours(value);
      onUpdate({ batchTimeHours: value });
    },
    [onUpdate],
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  return (
    <div className="step1">
      <h2 className="step1__title">What did you make?</h2>

      {/* Recipe name */}
      <div className="step1__field">
        <label className="step1__label" htmlFor="recipe-name">
          Recipe name
        </label>
        <input
          id="recipe-name"
          className={`step1__input${errors.name ? ' step1__input--error' : ''}`}
          type="text"
          placeholder="e.g. Chocolate Chip Cookies"
          value={name}
          onChange={handleNameChange}
          onBlur={handleBlur}
          autoComplete="off"
        />
        {errors.name && (
          <span className="step1__error" role="alert">
            {errors.name}
          </span>
        )}
      </div>

      {/* Quantity + Unit */}
      <div className="step1__row">
        <div className="step1__field">
          <label className="step1__label" htmlFor="recipe-quantity">
            Yield
          </label>
          <input
            id="recipe-quantity"
            className={`step1__input${errors.quantity ? ' step1__input--error' : ''}`}
            type="number"
            placeholder="24"
            min={1}
            step={1}
            value={quantity || ''}
            onChange={handleQuantityChange}
            onBlur={handleBlur}
          />
          {errors.quantity && (
            <span className="step1__error" role="alert">
              {errors.quantity}
            </span>
          )}
        </div>

        <div className="step1__field">
          <label className="step1__label" htmlFor="recipe-unit">
            Unit
          </label>
          <input
            id="recipe-unit"
            className="step1__input"
            type="text"
            placeholder="cookies"
            value={quantityUnit}
            onChange={handleUnitChange}
            onBlur={handleBlur}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Batch time */}
      <div className="step1__field">
        <label className="step1__label" htmlFor="recipe-time">
          Batch time (hours)
        </label>
        <input
          id="recipe-time"
          className={`step1__input${errors.batchTimeHours ? ' step1__input--error' : ''}`}
          type="number"
          placeholder="2"
          min={0}
          step={0.25}
          value={batchTimeHours || ''}
          onChange={handleTimeChange}
          onBlur={handleBlur}
        />
        {errors.batchTimeHours && (
          <span className="step1__error" role="alert">
            {errors.batchTimeHours}
          </span>
        )}
        <p className="step1__microcopy">
          We'll use this to calculate your time's worth later.
        </p>
      </div>
    </div>
  );
}
