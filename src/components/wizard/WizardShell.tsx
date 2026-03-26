import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { STEP_COUNT, STEP_LABELS } from './types';
import { wizardReducer, initialWizardState } from './wizardReducer';
import StepIndicator from './StepIndicator';
import './wizard.css';

/** CTA button labels per step */
const CTA_LABELS: Record<number, string> = {
  0: 'Next',
  1: 'Next',
  2: 'Next',
  3: 'See your true cost \u2192',
};

export default function WizardShell() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const { currentStep, direction, stepsCompleted } = state;

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayStep, setDisplayStep] = useState(currentStep);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track the previous step for animation direction
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (currentStep === prevStepRef.current) return;

    // Check reduced motion preference
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReduced) {
      setDisplayStep(currentStep);
      prevStepRef.current = currentStep;
      return;
    }

    // Trigger exit animation
    setIsAnimating(true);

    const timer = setTimeout(() => {
      setDisplayStep(currentStep);
      setIsAnimating(false);
      prevStepRef.current = currentStep;
    }, 200); // matches --duration-short

    return () => clearTimeout(timer);
  }, [currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep >= STEP_COUNT - 1) return;
    // In real implementation, validation would gate this.
    // For now, mark current step completed and advance.
    dispatch({ type: 'MARK_STEP_COMPLETED', step: currentStep });
    dispatch({ type: 'NEXT_STEP' });
  }, [currentStep]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const handleGoToStep = useCallback((step: number) => {
    dispatch({ type: 'GO_TO_STEP', step });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.target === e.currentTarget) {
        handleNext();
      }
    },
    [handleNext],
  );

  const isLastStep = currentStep === STEP_COUNT - 1;
  const isFirstStep = currentStep === 0;

  // Determine animation CSS class
  const getAnimationClass = () => {
    if (!isAnimating) return 'wizard-content--enter';
    return direction === 'forward'
      ? 'wizard-content--exit-left'
      : 'wizard-content--exit-right';
  };

  return (
    <div className="wizard" onKeyDown={handleKeyDown}>
      {/* Persistent header */}
      <header className="wizard-header">
        <h1 className="wizard-header__title">RecipeCalc</h1>
        <StepIndicator
          currentStep={currentStep}
          stepsCompleted={stepsCompleted}
          onGoToStep={handleGoToStep}
        />
      </header>

      {/* Content area */}
      <main className="wizard-main">
        <div
          ref={contentRef}
          className={`wizard-content ${getAnimationClass()}`}
          data-step={displayStep}
        >
          <h2 className="wizard-content__step-title">
            {STEP_LABELS[displayStep]}
          </h2>
          <div className="wizard-content__placeholder">
            Step {displayStep + 1} placeholder
          </div>
        </div>
      </main>

      {/* Bottom CTA area */}
      <footer className="wizard-footer">
        <div className="wizard-footer__inner">
          {!isFirstStep && (
            <button
              type="button"
              className="wizard-btn wizard-btn--back"
              onClick={handleBack}
              aria-label="Go to previous step"
            >
              Back
            </button>
          )}
          <button
            type="button"
            className={`wizard-btn wizard-btn--next ${
              isLastStep ? 'wizard-btn--reveal' : ''
            }`}
            onClick={handleNext}
            disabled={isLastStep}
            aria-label={
              isLastStep ? 'See your true cost' : 'Go to next step'
            }
          >
            {CTA_LABELS[currentStep]}
          </button>
        </div>
      </footer>
    </div>
  );
}
