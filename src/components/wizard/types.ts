import type { Recipe, Ingredient, LaborAndOverhead } from '../../lib/calc/types';

export const STEP_LABELS = [
  'Recipe Info',
  'Ingredients',
  'Labor & Overhead',
  'Your True Cost',
] as const;

export const STEP_COUNT = STEP_LABELS.length;

export type StepDirection = 'forward' | 'backward';

export interface WizardState {
  currentStep: number; // 0-indexed (0–3)
  direction: StepDirection;
  /** Track which steps have valid data (for navigation gating) */
  stepsCompleted: boolean[];
  /** The recipe data built up across all steps */
  recipe: Recipe;
}

export const DEFAULT_RECIPE: Recipe = {
  name: '',
  quantity: 1,
  quantityUnit: 'pieces',
  batchTimeHours: 0,
  ingredients: [],
  laborAndOverhead: {
    hourlyRate: 0,
    packaging: 0,
    overhead: 0,
    platformFees: 0,
  },
};

export type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'MARK_STEP_COMPLETED'; step: number }
  | { type: 'MARK_STEP_INCOMPLETE'; step: number }
  | { type: 'UPDATE_RECIPE_INFO'; data: Partial<Pick<Recipe, 'name' | 'quantity' | 'quantityUnit' | 'batchTimeHours'>> }
  | { type: 'UPDATE_INGREDIENTS'; ingredients: Ingredient[] }
  | { type: 'UPDATE_LABOR'; data: Partial<LaborAndOverhead> }
  | { type: 'RESTORE_STATE'; step: number; recipe: Recipe }
  | { type: 'RESET' };
