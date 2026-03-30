import { useReducer, useCallback, useRef, useEffect, useState } from 'react';
import { STEP_COUNT } from './types';
import { wizardReducer, initialWizardState } from './wizardReducer';
import StepIndicator from './StepIndicator';
import { ResumeBanner } from './ResumeBanner';
import Step1RecipeInfo from './steps/Step1RecipeInfo';
import Step2Ingredients from './steps/Step2Ingredients';
import Step3LaborOverhead from './steps/Step3LaborOverhead';
import Step4Reveal from './steps/Step4Reveal';
import { useRecipePersistence } from '../../hooks/useRecipePersistence';
import { readRecipes } from '../../hooks/useRecipes';
import { LicenseProvider } from '../../contexts/LicenseContext';
import { trackEvent, EVENTS } from '../../lib/analytics';
import './wizard.css';

/** CTA button labels per step (step 3 has its own actions, so no entry needed) */
const CTA_LABELS = ['Next', 'Next', 'See your true cost \u2192'] as const;

export default function WizardShell() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const { currentStep, direction, stepsCompleted, recipe } = state;

  // Step validity tracking — each step reports whether its data is valid
  const [stepValid, setStepValid] = useState<boolean[]>([false, false, true, true]);

  // Key to force re-mount of step components after resume (so local state re-initializes from props)
  const [restoreKey, setRestoreKey] = useState(0);

  // Track editing state when loading a saved recipe via ?edit=<id>
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

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
  const prevStepRef = useRef(currentStep);

  // On mount: detect ?edit=<id> and load saved recipe for editing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (!editId) return;

    const savedRecipes = readRecipes();
    const found = savedRecipes.find((r) => r.id === editId);
    if (!found) return;

    setEditingRecipeId(editId);
    dispatch({ type: 'RESTORE_STATE', step: 3, recipe: found.recipe });
    setStepValid([true, true, true, true]);
    setDisplayStep(3);
    prevStepRef.current = 3;
    setRestoreKey((k) => k + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleValidChange = useCallback((step: number) => (valid: boolean) => {
    setStepValid(prev => {
      if (prev[step] === valid) return prev;
      const next = [...prev];
      next[step] = valid;
      return next;
    });
    dispatch({ type: valid ? 'MARK_STEP_COMPLETED' : 'MARK_STEP_INCOMPLETE', step });
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep >= STEP_COUNT - 1) return;
    if (!stepValid[currentStep]) return;
    trackEvent(EVENTS.STEP_COMPLETE, { step: String(currentStep + 1) });
    if (currentStep + 1 === STEP_COUNT - 1) {
      trackEvent(EVENTS.WIZARD_COMPLETE);
    }
    dispatch({ type: 'MARK_STEP_COMPLETED', step: currentStep });
    dispatch({ type: 'NEXT_STEP' });
  }, [currentStep, stepValid]);

  // dispatch is stable from useReducer, so no useCallback needed for simple forwards
  const handleBack = () => dispatch({ type: 'PREV_STEP' });
  const handleGoToStep = (step: number) => dispatch({ type: 'GO_TO_STEP', step });

  const handleStartNew = useCallback(() => {
    trackEvent(EVENTS.NEW_RECIPE);
    clear();
    dispatch({ type: 'RESET' });
    setEditingRecipeId(null);
    setStepValid([false, false, true, true]);
    setDisplayStep(0);
    prevStepRef.current = 0;
  }, [clear]);

  const handleResumeContinue = useCallback(() => {
    if (!savedData) { dismiss(); return; }
    trackEvent(EVENTS.RESUME_RECIPE);
    dispatch({ type: 'RESTORE_STATE', step: savedData.step, recipe: savedData.recipe });
    setStepValid(prev => {
      const next = [...prev];
      for (let i = 0; i < savedData.step; i++) next[i] = true;
      return next;
    });
    setDisplayStep(savedData.step);
    prevStepRef.current = savedData.step;
    setRestoreKey(k => k + 1);
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

  const isFirstStep = currentStep === 0;

  function animationClass(): string {
    if (!isAnimating) return 'wizard-content--enter';
    return direction === 'forward'
      ? 'wizard-content--exit-left'
      : 'wizard-content--exit-right';
  }

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
            editingRecipeId={editingRecipeId}
          />
        );
      default:
        return null;
    }
  };

  return (
    <LicenseProvider>
      <div className="wizard" onKeyDown={handleKeyDown}>
        {showResume && savedData && (
          <ResumeBanner
            recipeName={savedData.recipe.name || 'Untitled recipe'}
            onContinue={handleResumeContinue}
            onStartFresh={handleResumeFresh}
          />
        )}

        <header className="wizard-header">
          <h1 className="wizard-header__title">RecipeCalc</h1>
          <StepIndicator
            currentStep={currentStep}
            stepsCompleted={stepsCompleted}
            onGoToStep={handleGoToStep}
          />
        </header>

        <main className="wizard-main">
          <div
            className={`wizard-content ${animationClass()}`}
            data-step={displayStep}
            key={`${displayStep}-${restoreKey}`}
          >
            {renderStep()}
          </div>
        </main>

        {/* Step 4 (reveal) has its own actions, so hide the shared footer */}
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
                className="wizard-btn wizard-btn--next"
                onClick={handleNext}
                disabled={!stepValid[currentStep]}
                aria-label="Go to next step"
              >
                {CTA_LABELS[currentStep]}
              </button>
            </div>
          </footer>
        )}
      </div>
    </LicenseProvider>
  );
}
