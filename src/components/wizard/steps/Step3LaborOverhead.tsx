import { useState, useCallback, useEffect } from 'react';
import type { Recipe, LaborAndOverhead } from '../../../lib/calc/types';
import './step3.css';

interface Step3Props {
  recipe: Recipe;
  onUpdate: (data: Partial<LaborAndOverhead>) => void;
  onValidChange: (valid: boolean) => void;
}

/** Format a number as USD with 2 decimal places */
function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function Step3LaborOverhead({
  recipe,
  onUpdate,
  onValidChange,
}: Step3Props) {
  const { laborAndOverhead, batchTimeHours } = recipe;

  const [hourlyRate, setHourlyRate] = useState(String(laborAndOverhead.hourlyRate));
  const [laborTime, setLaborTime] = useState(String(batchTimeHours));
  const [packaging, setPackaging] = useState(String(laborAndOverhead.packaging));
  const [overhead, setOverhead] = useState(String(laborAndOverhead.overhead));
  const [platformFees, setPlatformFees] = useState(String(laborAndOverhead.platformFees));

  // Track which fields have been touched for inline error display
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // Parse to number, empty string -> 0
  const parse = (val: string): number => {
    if (val.trim() === '') return 0;
    return Number(val);
  };

  const hourlyRateNum = parse(hourlyRate);
  const laborTimeNum = parse(laborTime);
  const packagingNum = parse(packaging);
  const overheadNum = parse(overhead);
  const platformFeesNum = parse(platformFees);

  // Validation: all fields must be >= 0
  const errors: Record<string, string> = {};
  if (touched.hourlyRate && hourlyRateNum < 0) errors.hourlyRate = 'Must be 0 or greater';
  if (touched.laborTime && laborTimeNum < 0) errors.laborTime = 'Must be 0 or greater';
  if (touched.packaging && packagingNum < 0) errors.packaging = 'Must be 0 or greater';
  if (touched.overhead && overheadNum < 0) errors.overhead = 'Must be 0 or greater';
  if (touched.platformFees && platformFeesNum < 0) errors.platformFees = 'Must be 0 or greater';

  const hasNegative =
    hourlyRateNum < 0 ||
    laborTimeNum < 0 ||
    packagingNum < 0 ||
    overheadNum < 0 ||
    platformFeesNum < 0;

  const hasNaN =
    isNaN(hourlyRateNum) ||
    isNaN(laborTimeNum) ||
    isNaN(packagingNum) ||
    isNaN(overheadNum) ||
    isNaN(platformFeesNum);

  const isValid = !hasNegative && !hasNaN;

  // Labor cost = hourlyRate * laborTime
  const laborCost =
    !isNaN(hourlyRateNum) && !isNaN(laborTimeNum) && hourlyRateNum >= 0 && laborTimeNum >= 0
      ? hourlyRateNum * laborTimeNum
      : 0;

  // Notify parent of validity changes
  useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  // Notify parent of data changes
  useEffect(() => {
    if (isValid) {
      onUpdate({
        hourlyRate: hourlyRateNum,
        packaging: packagingNum,
        overhead: overheadNum,
        platformFees: platformFeesNum,
      });
    }
  }, [hourlyRateNum, packagingNum, overheadNum, platformFeesNum, isValid, onUpdate]);

  return (
    <div className="step3" data-testid="step3-labor-overhead">
      <header>
        <h2 className="step3__title">Labor &amp; Overhead</h2>
        <p className="step3__subtitle">
          Add your time, packaging, and operating costs.
        </p>
      </header>

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
            onChange={(e) => setHourlyRate(e.target.value)}
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
        <span className="step3__labor-preview-value">{formatUsd(laborCost)}</span>
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
            onChange={(e) => setPackaging(e.target.value)}
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
            onChange={(e) => setOverhead(e.target.value)}
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
            onChange={(e) => setPlatformFees(e.target.value)}
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
