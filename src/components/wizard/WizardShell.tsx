import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { STEP_COUNT, STEP_LABELS } from './types';
import type { WizardAction } from './types';
import { wizardReducer, initialWizardState } from './wizardReducer';
import StepIndicator from './StepIndicator';
import { ResumeBanner } from './ResumeBanner';
import Step1RecipeInfo from './steps/Step1RecipeInfo';
import Step2Ingredients from './steps/Step2Ingredients';
import Step3LaborOverhead from './steps/Step3LaborOverhead';
import Step4Reveal from './steps/Step4Reveal';
import { useRecipePersistence } from '../../hooks/useRecipePersistence';
import './wizard.css';

/** CTA button labels per step */
const CTA_LABELS: Record<number, string> = {
  0: 'Next',
  1: 'Next',
  2: 'See your true cost \u2192',
};

export default function WizardShell() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const { currentStep, direction, stepsCompleted, recipe } = state;

  // Step validity tracking — each step reports whether its data is valid
  const [stepValid, setStepValid] = useState<boolean[]>([false, false, true, true]);

  // Key to force re-mount of step components after resume (so local state re-initializes from props)
  const [restoreKey, setRestoreKey] = useState(0);

  // localStorage persistence
  const { savedData, save, clear, dismiss, showResume } = useRecipePersistence();

  // Auto-save on state changes (skip step 0 with empty recipe)
  useEffect(() => {
    if (recipe.name || recipe.ingredients.length > 0) {
      save(currentStep, recipe);
    }
  }, [currentStep, recipe, save]);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayStep, setDisplayStep] = useState(currentStep);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef(currentStep);

  useEffect(() => {
    if (currentStep === prevStepRef.current) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReduced) {
      setDisplayStep(currentStep);
      prevStepRef.current = currentStep;
      return;
    }

    setIsAnimating(true);

    const timer = setTimeout(() => {
      setDisplayStep(currentStep);
      setIsAnimating(false);
      prevStepRef.current = currentStep;
    }, 200);

    return () => clearTimeout(timer);
  }, [currentStep]);

  // Step validity change handler
  const handleValidChange = useCallback((step: number) => (valid: boolean) => {
    setStepValid(prev => {
      if (prev[step] === valid) return prev;
      const next = [...prev];
      next[step] = valid;
      return next;
    });
    if (valid) {
      dispatch({ type: 'MARK_STEP_COMPLETED', step });
    } else {
      dispatch({ type: 'MARK_STEP_INCOMPLETE', step });
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep >= STEP_COUNT - 1) return;
    if (!stepValid[currentStep]) return;
    dispatch({ type: 'MARK_STEP_COMPLETED', step: currentStep });
    dispatch({ type: 'NEXT_STEP' });
  }, [currentStep, stepValid]);

  const handleBack = useCallback(() => {
    dispatch({ type: 'PREV_STEP' });
  }, []);

  const handleGoToStep = useCallback((step: number) => {
    dispatch({ type: 'GO_TO_STEP', step });
  }, []);

  const handleStartNew = useCallback(() => {
    clear();
    dispatch({ type: 'RESET' });
    setStepValid([false, false, true, true]);
    setDisplayStep(0);
    prevStepRef.current = 0;
  }, [clear]);

  // Resume handlers
  const handleResumeContinue = useCallback(() => {
    if (savedData) {
      dispatch({ type: 'RESTORE_STATE', step: savedData.step, recipe: savedData.recipe });
      // Mark all prior steps as valid so navigation works
      setStepValid(prev => {
        const next = [...prev];
        for (let i = 0; i < savedData.step; i++) next[i] = true;
        return next;
      });
      setDisplayStep(savedData.step);
      prevStepRef.current = savedData.step;
      // Force re-mount of step components so local state re-initializes from restored props
      setRestoreKey(k => k + 1);
    }
    dismiss();
  }, [savedData, dismiss]);

  const handleResumeFresh = useCallback(() => {
    clear();
    dismiss();
  }, [clear, dismiss]);

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

  const getAnimationClass = () => {
    if (!isAnimating) return 'wizard-content--enter';
    return direction === 'forward'
      ? 'wizard-content--exit-left'
      : 'wizard-content--exit-right';
  };

  // Render the current step component
  const renderStep = () => {
    switch (displayStep) {
      case 0:
        return (
          <Step1RecipeInfo
            recipe={recipe}
            onUpdate={(data) => dispatch({ type: 'UPDATE_RECIPE_INFO', data })}
            onValidChange={handleValidChange(0)}
          />
        );
      case 1:
        return (
          <Step2Ingredients
            recipe={recipe}
            onIngredientsChange={(ingredients) => dispatch({ type: 'UPDATE_INGREDIENTS', ingredients })}
            onValidChange={handleValidChange(1)}
          />
        );
      case 2:
        return (
          <Step3LaborOverhead
            recipe={recipe}
            onUpdate={(data) => dispatch({ type: 'UPDATE_LABOR', data })}
            onValidChange={handleValidChange(2)}
          />
        );
      case 3:
        return (
          <Step4Reveal
            recipe={recipe}
            onStartNew={handleStartNew}
            onGoToStep={handleGoToStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="wizard" onKeyDown={handleKeyDown}>
      {/* Resume banner */}
      {showResume && savedData && (
        <ResumeBanner
          recipeName={savedData.recipe.name || 'Untitled recipe'}
          onContinue={handleResumeContinue}
          onStartFresh={handleResumeFresh}
        />
      )}

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
          key={`${displayStep}-${restoreKey}`}
        >
          {renderStep()}
        </div>
      </main>

      {/* Bottom CTA area — hidden on Step 4 (reveal has its own actions) */}
      {displayStep < 3 && (
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
              className={`wizard-btn wizard-btn--next`}
              onClick={handleNext}
              disabled={!stepValid[currentStep]}
              aria-label="Go to next step"
            >
              {CTA_LABELS[currentStep] || 'Next'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
