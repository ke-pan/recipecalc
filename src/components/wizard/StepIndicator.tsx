import { STEP_COUNT, STEP_LABELS } from './types';

interface StepIndicatorProps {
  currentStep: number;
  stepsCompleted: boolean[];
  onGoToStep: (step: number) => void;
}

export default function StepIndicator({
  currentStep,
  stepsCompleted,
  onGoToStep,
}: StepIndicatorProps) {
  return (
    <nav className="wizard-steps" aria-label="Wizard progress">
      <ol className="wizard-steps__list">
        {Array.from({ length: STEP_COUNT }, (_, i) => {
          const isCurrent = i === currentStep;
          const isCompleted = stepsCompleted[i];
          const isClickable = isCompleted && !isCurrent;

          return (
            <li key={i} className="wizard-steps__item">
              <button
                type="button"
                className={[
                  'wizard-steps__dot',
                  isCurrent && 'wizard-steps__dot--current',
                  isCompleted && !isCurrent && 'wizard-steps__dot--completed',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`Step ${i + 1} of ${STEP_COUNT}: ${STEP_LABELS[i]}`}
                aria-current={isCurrent ? 'step' : undefined}
                disabled={!isClickable}
                onClick={() => isClickable && onGoToStep(i)}
                tabIndex={isClickable ? 0 : -1}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
