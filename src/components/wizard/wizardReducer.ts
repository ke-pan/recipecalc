import type { Recipe } from '../../lib/calc/types';
import type { WizardState, WizardAction } from './types';
import { STEP_COUNT, DEFAULT_RECIPE } from './types';

function freshRecipe(): Recipe {
  return {
    ...DEFAULT_RECIPE,
    ingredients: [],
    laborAndOverhead: { ...DEFAULT_RECIPE.laborAndOverhead },
  };
}

function withStepCompletion(stepsCompleted: boolean[], step: number, value: boolean): boolean[] {
  if (stepsCompleted[step] === value) return stepsCompleted;
  const next = [...stepsCompleted];
  next[step] = value;
  return next;
}

export const initialWizardState: WizardState = {
  currentStep: 0,
  direction: 'forward',
  stepsCompleted: Array(STEP_COUNT).fill(false),
  recipe: freshRecipe(),
};

export function wizardReducer(
  state: WizardState,
  action: WizardAction,
): WizardState {
  switch (action.type) {
    case 'NEXT_STEP': {
      if (state.currentStep >= STEP_COUNT - 1) return state;
      return {
        ...state,
        currentStep: state.currentStep + 1,
        direction: 'forward',
      };
    }

    case 'PREV_STEP': {
      if (state.currentStep <= 0) return state;
      return {
        ...state,
        currentStep: state.currentStep - 1,
        direction: 'backward',
      };
    }

    case 'GO_TO_STEP': {
      const { step } = action;
      if (step < 0 || step >= STEP_COUNT) return state;
      if (step === state.currentStep) return state;
      if (step > state.currentStep) {
        for (let i = state.currentStep; i < step; i++) {
          if (!state.stepsCompleted[i]) return state;
        }
      }
      return {
        ...state,
        currentStep: step,
        direction: step > state.currentStep ? 'forward' : 'backward',
      };
    }

    case 'MARK_STEP_COMPLETED':
      return { ...state, stepsCompleted: withStepCompletion(state.stepsCompleted, action.step, true) };

    case 'MARK_STEP_INCOMPLETE':
      return { ...state, stepsCompleted: withStepCompletion(state.stepsCompleted, action.step, false) };

    case 'UPDATE_RECIPE_INFO': {
      return {
        ...state,
        recipe: { ...state.recipe, ...action.data },
      };
    }

    case 'UPDATE_INGREDIENTS': {
      return {
        ...state,
        recipe: { ...state.recipe, ingredients: action.ingredients },
      };
    }

    case 'UPDATE_LABOR': {
      return {
        ...state,
        recipe: {
          ...state.recipe,
          laborAndOverhead: { ...state.recipe.laborAndOverhead, ...action.data },
        },
      };
    }

    case 'RESTORE_STATE': {
      // Mark all steps before the restored step as completed so navigation works
      const restored = Array(STEP_COUNT).fill(false);
      for (let i = 0; i < action.step; i++) {
        restored[i] = true;
      }
      return {
        ...state,
        currentStep: action.step,
        recipe: action.recipe,
        stepsCompleted: restored,
        direction: 'forward',
      };
    }

    case 'RESET':
      return {
        ...initialWizardState,
        stepsCompleted: Array(STEP_COUNT).fill(false) as boolean[],
        recipe: freshRecipe(),
      };

    default:
      return state;
  }
}
