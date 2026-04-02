import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Recipe, LaborAndOverhead } from '../../../lib/calc/types.js';
import { useLicense } from '../../../contexts/LicenseContext.js';
import { useDefaults } from '../../../hooks/useDefaults.js';
import { formatCurrency } from '../../../lib/format.js';
import './step3.css';

interface Step3Props {
  recipe: Recipe;
  onUpdate: (data: Partial<LaborAndOverhead>) => void;
  onValidChange: (valid: boolean) => void;
}

/** Parse string to number, treating empty/whitespace as 0. */
function parseField(val: string): number {
  const trimmed = val.trim();
  return trimmed === '' ? 0 : Number(trimmed);
}

export default function Step3LaborOverhead({
  recipe,
  onUpdate,
  onValidChange,
}: Step3Props) {
  const { laborAndOverhead, batchTimeHours } = recipe;
  const { isUnlocked } = useLicense();
  const { defaults } = useDefaults();

  // For paid users: if recipe fields are all zero (fresh recipe), pre-fill from defaults.
  // "Using defaults" means the user has non-zero defaults AND the recipe fields were all zero.
  const hasNonZeroDefaults =
    defaults.hourlyRate !== 0 ||
    defaults.packaging !== 0 ||
    defaults.overhead !== 0 ||
    defaults.platformFees !== 0;

  const recipeFieldsAllZero =
    laborAndOverhead.hourlyRate === 0 &&
    laborAndOverhead.packaging === 0 &&
    laborAndOverhead.overhead === 0 &&
    laborAndOverhead.platformFees === 0;

  const shouldPreFill = isUnlocked && hasNonZeroDefaults && recipeFieldsAllZero;

  const initialHourlyRate = shouldPreFill ? defaults.hourlyRate : laborAndOverhead.hourlyRate;
  const initialPackaging = shouldPreFill ? defaults.packaging : laborAndOverhead.packaging;
  const initialOverhead = shouldPreFill ? defaults.overhead : laborAndOverhead.overhead;
  const initialPlatformFees = shouldPreFill ? defaults.platformFees : laborAndOverhead.platformFees;

  const [hourlyRate, setHourlyRate] = useState(String(initialHourlyRate));
  const [laborTime, setLaborTime] = useState(String(batchTimeHours));
  const [packaging, setPackaging] = useState(String(initialPackaging));
  const [overhead, setOverhead] = useState(String(initialOverhead));
  const [platformFees, setPlatformFees] = useState(String(initialPlatformFees));

  // Track whether we're showing defaults (user hasn't manually changed the pre-filled values)
  const [usingDefaults, setUsingDefaults] = useState(shouldPreFill);

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const parsedHourlyRate = parseField(hourlyRate);
  const parsedLaborTime = parseField(laborTime);
  const parsedPackaging = parseField(packaging);
  const parsedOverhead = parseField(overhead);
  const parsedPlatformFees = parseField(platformFees);

  const allParsed = [parsedHourlyRate, parsedLaborTime, parsedPackaging, parsedOverhead, parsedPlatformFees];
  const isValid = allParsed.every((v) => !isNaN(v) && v >= 0);

  const errors = useMemo(() => {
    const result: Record<string, string> = {};
    const fields: Record<string, number> = {
      hourlyRate: parsedHourlyRate,
      laborTime: parsedLaborTime,
      packaging: parsedPackaging,
      overhead: parsedOverhead,
      platformFees: parsedPlatformFees,
    };
    for (const [field, value] of Object.entries(fields)) {
      if (touched[field] && value < 0) {
        result[field] = 'Must be 0 or greater';
      }
    }
    return result;
  }, [parsedHourlyRate, parsedLaborTime, parsedPackaging, parsedOverhead, parsedPlatformFees, touched]);

  const laborCost =
    isValid && parsedHourlyRate >= 0 && parsedLaborTime >= 0
      ? parsedHourlyRate * parsedLaborTime
      : 0;

  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  useEffect(() => {
    if (isValid) {
      onUpdate({
        hourlyRate: parsedHourlyRate,
        packaging: parsedPackaging,
        overhead: parsedOverhead,
        platformFees: parsedPlatformFees,
      });
    }
  }, [parsedHourlyRate, parsedPackaging, parsedOverhead, parsedPlatformFees, isValid, onUpdate]);

  return (
    <div className="step3" data-testid="step3-labor-overhead">
      <header>
        <h2 className="step3__title">Labor &amp; Overhead</h2>
        <p className="step3__subtitle">
          Add your time, packaging, and operating costs.
        </p>
      </header>

      {/* Defaults hint for paid users */}
      {usingDefaults && (
        <p className="step3__defaults-hint" data-testid="defaults-hint">
          Using your defaults. Edit any field to override.
        </p>
      )}

      {/* Hourly Rate */}
      <div className="step3__field">
        <label className="step3__label" htmlFor="step3-hourly-rate">
          Hourly rate
        </label>
        <div className="step3__input-wrapper">
          <span className="step3__currency" aria-hidden="true">$</span>
          <input
            id="step3-hourly-rate"
            className={`step3__input${errors.hourlyRate ? ' step3__input--error' : ''}`}
            type="number"
            min="0"
            step="any"
            placeholder="15"
            value={hourlyRate}
            onChange={(e) => { setHourlyRate(e.target.value); setUsingDefaults(false); }}
            onBlur={() => markTouched('hourlyRate')}
            aria-describedby={errors.hourlyRate ? 'step3-hourly-rate-error' : undefined}
            aria-invalid={!!errors.hourlyRate}
          />
        </div>
        <div id="step3-hourly-rate-error" className="step3__error" role="alert">
          {errors.hourlyRate ?? ''}
        </div>
      </div>

      {/* Labor Time */}
      <div className="step3__field">
        <label className="step3__label" htmlFor="step3-labor-time">
          Labor time{' '}
          <span className="step3__label-hint">(hours)</span>
        </label>
        <div className="step3__input-wrapper">
          <input
            id="step3-labor-time"
            className={`step3__input step3__input--plain${errors.laborTime ? ' step3__input--error' : ''}`}
            type="number"
            min="0"
            step="any"
            value={laborTime}
            onChange={(e) => setLaborTime(e.target.value)}
            onBlur={() => markTouched('laborTime')}
            aria-describedby={errors.laborTime ? 'step3-labor-time-error' : undefined}
            aria-invalid={!!errors.laborTime}
          />
          <span className="step3__suffix" aria-hidden="true">hrs</span>
        </div>
        <div id="step3-labor-time-error" className="step3__error" role="alert">
          {errors.laborTime ?? ''}
        </div>
      </div>

      {/* Labor Cost Preview */}
      <div className="step3__labor-preview" data-testid="labor-cost-preview">
        <span className="step3__labor-preview-label">Labor cost</span>
        <span className="step3__labor-preview-value">{formatCurrency(laborCost)}</span>
      </div>

      {/* Packaging */}
      <div className="step3__field">
        <label className="step3__label" htmlFor="step3-packaging">
          Packaging
        </label>
        <div className="step3__input-wrapper">
          <span className="step3__currency" aria-hidden="true">$</span>
          <input
            id="step3-packaging"
            className={`step3__input${errors.packaging ? ' step3__input--error' : ''}`}
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={packaging}
            onChange={(e) => { setPackaging(e.target.value); setUsingDefaults(false); }}
            onBlur={() => markTouched('packaging')}
            aria-describedby={errors.packaging ? 'step3-packaging-error' : undefined}
            aria-invalid={!!errors.packaging}
          />
        </div>
        <div id="step3-packaging-error" className="step3__error" role="alert">
          {errors.packaging ?? ''}
        </div>
      </div>

      {/* Overhead */}
      <div className="step3__field">
        <label className="step3__label" htmlFor="step3-overhead">
          Overhead
        </label>
        <div className="step3__input-wrapper">
          <span className="step3__currency" aria-hidden="true">$</span>
          <input
            id="step3-overhead"
            className={`step3__input${errors.overhead ? ' step3__input--error' : ''}`}
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={overhead}
            onChange={(e) => { setOverhead(e.target.value); setUsingDefaults(false); }}
            onBlur={() => markTouched('overhead')}
            aria-describedby={errors.overhead ? 'step3-overhead-error' : undefined}
            aria-invalid={!!errors.overhead}
          />
        </div>
        <div id="step3-overhead-error" className="step3__error" role="alert">
          {errors.overhead ?? ''}
        </div>
      </div>

      {/* Platform Fees */}
      <div className="step3__field">
        <label className="step3__label" htmlFor="step3-platform-fees">
          Platform fees{' '}
          <span className="step3__label-hint">Fixed platform or delivery fees</span>
        </label>
        <div className="step3__input-wrapper">
          <span className="step3__currency" aria-hidden="true">$</span>
          <input
            id="step3-platform-fees"
            className={`step3__input${errors.platformFees ? ' step3__input--error' : ''}`}
            type="number"
            min="0"
            step="any"
            placeholder="0"
            value={platformFees}
            onChange={(e) => { setPlatformFees(e.target.value); setUsingDefaults(false); }}
            onBlur={() => markTouched('platformFees')}
            aria-describedby={errors.platformFees ? 'step3-platform-fees-error' : undefined}
            aria-invalid={!!errors.platformFees}
          />
        </div>
        <div id="step3-platform-fees-error" className="step3__error" role="alert">
          {errors.platformFees ?? ''}
        </div>
      </div>

      {/* Static tip */}
      <p className="step3__tip" data-testid="step3-tip">
        Industry average: labor + overhead = 40-60% of total cost.
      </p>
    </div>
  );
}
