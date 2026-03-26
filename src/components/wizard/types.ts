/**
 * Wizard state management types.
 *
 * The wizard has 4 steps:
 *   1. Recipe info
 *   2. Ingredients
 *   3. Labor & overhead
 *   4. Reveal (cost breakdown + pricing)
 */

export const STEP_COUNT = 4;

export const STEP_LABELS = [
  'Recipe Info',
  'Ingredients',
  'Labor & Overhead',
  'Your True Cost',
] as const;

export type StepDirection = 'forward' | 'backward';

export interface WizardState {
  currentStep: number; // 0-indexed (0–3)
  direction: StepDirection;
  /** Track which steps have valid data (for navigation gating) */
  stepsCompleted: boolean[];
}

export type WizardAction =
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'GO_TO_STEP'; step: number }
  | { type: 'MARK_STEP_COMPLETED'; step: number }
  | { type: 'MARK_STEP_INCOMPLETE'; step: number };
