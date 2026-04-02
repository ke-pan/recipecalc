/**
 * Umami analytics wrapper.
 *
 * Safe to import in both server and client contexts.
 * When Umami is not loaded (dev, missing env vars, SSR), trackEvent is a noop.
 */

declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, string>) => void;
    };
  }
}

/** All tracked event names. */
export const EVENTS = {
  STEP_COMPLETE: 'step_complete',
  WIZARD_COMPLETE: 'wizard_complete',
  PAYWALL_VIEW: 'paywall_view',
  PAYWALL_CLICK: 'paywall_click',
  PURCHASE_COMPLETE: 'purchase_complete',
  ACTIVATE_SUCCESS: 'activate_success',
  ACTIVATE_FAIL: 'activate_fail',
  COPY_RESULT: 'copy_result',
  SAVE_RECIPE: 'save_recipe',
  EXPORT_JSON: 'export_json',
  IMPORT_JSON: 'import_json',
  RESUME_RECIPE: 'resume_recipe',
  NEW_RECIPE: 'new_recipe',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Track a named event with optional string-keyed data.
 *
 * Silently does nothing when:
 * - Running on the server (SSR)
 * - Umami script was not loaded (dev mode, missing env vars)
 */
export function trackEvent(
  name: string,
  data?: Record<string, string>,
): void {
  if (typeof window === 'undefined') return;
  window.umami?.track(name, data);
}
