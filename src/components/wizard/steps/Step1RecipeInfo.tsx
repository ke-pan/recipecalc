import { useState, useEffect, useRef } from 'react';
import type { Recipe } from '../../../lib/calc/types.js';
import './step1.css';

type Step1Fields = Pick<Recipe, 'name' | 'quantity' | 'quantityUnit' | 'batchTimeHours'>;

interface Step1Props {
  recipe: Recipe;
  onUpdate: (data: Partial<Step1Fields>) => void;
  onValidChange: (valid: boolean) => void;
}

interface FieldErrors {
  name?: string;
  quantity?: string;
  batchTimeHours?: string;
}

function validate(name: string, quantity: number, batchTimeHours: number): FieldErrors {
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

  const lastValidRef = useRef<boolean | null>(null);

  useEffect(() => {
    const fieldErrors = validate(name, quantity, batchTimeHours);
    const isValid = Object.keys(fieldErrors).length === 0;

    if (lastValidRef.current !== isValid) {
      lastValidRef.current = isValid;
      onValidChange(isValid);
    }

    if (touched) {
      setErrors(fieldErrors);
    }
  }, [name, quantity, batchTimeHours, touched, onValidChange]);

  function handleText(
    field: 'name' | 'quantityUnit',
    setter: (v: string) => void,
    e: React.ChangeEvent<HTMLInputElement>,
  ): void {
    setter(e.target.value);
    onUpdate({ [field]: e.target.value });
  }

  function handleNumber(
    field: 'quantity' | 'batchTimeHours',
    setter: (v: number) => void,
    e: React.ChangeEvent<HTMLInputElement>,
  ): void {
    const value = e.target.valueAsNumber || 0;
    setter(value);
    onUpdate({ [field]: value });
  }

  function handleBlur(): void {
    setTouched(true);
  }

  return (
    <div className="step1">
      <h2 className="step1__title">What did you make?</h2>

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
          onChange={(e) => handleText('name', setName, e)}
          onBlur={handleBlur}
          autoComplete="off"
        />
        {errors.name && (
          <span className="step1__error" role="alert">
            {errors.name}
          </span>
        )}
      </div>

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
            onChange={(e) => handleNumber('quantity', setQuantity, e)}
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
            onChange={(e) => handleText('quantityUnit', setQuantityUnit, e)}
            onBlur={handleBlur}
            autoComplete="off"
          />
        </div>
      </div>

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
          onChange={(e) => handleNumber('batchTimeHours', setBatchTimeHours, e)}
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
