import type { WizardState, WizardAction } from './types';
import { STEP_COUNT } from './types';

export const initialWizardState: WizardState = {
  currentStep: 0,
  direction: 'forward',
  stepsCompleted: Array(STEP_COUNT).fill(false),
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
      // Can only jump to completed steps or the next available step
      if (step > state.currentStep) {
        // Can only go forward if all intermediate steps are completed
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

    case 'MARK_STEP_COMPLETED': {
      const completed = [...state.stepsCompleted];
      completed[action.step] = true;
      return { ...state, stepsCompleted: completed };
    }

    case 'MARK_STEP_INCOMPLETE': {
      const completed = [...state.stepsCompleted];
      completed[action.step] = false;
      return { ...state, stepsCompleted: completed };
    }

    default:
      return state;
  }
}
