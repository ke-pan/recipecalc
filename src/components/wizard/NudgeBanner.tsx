/**
 * NudgeBanner — a gentle, dismissible inline reminder.
 *
 * Follows DESIGN.md caution style: caution-tinted background with a small
 * icon. NOT a `border-left: 3px solid` SaaS warning banner.
 *
 * Props:
 *   - message: the nudge text
 *   - onDismiss: callback when the user closes it
 *   - cta (optional): { label, onClick } for an inline action link
 */

import './nudge-banner.css';

export interface NudgeBannerProps {
  message: string;
  onDismiss: () => void;
  cta?: { label: string; onClick: () => void };
  testId?: string;
}

export default function NudgeBanner({
  message,
  onDismiss,
  cta,
  testId,
}: NudgeBannerProps) {
  return (
    <div className="nudge-banner" role="status" data-testid={testId}>
      <span className="nudge-banner__icon" aria-hidden="true">
        &#x26A0;&#xFE0E;
      </span>
      <p className="nudge-banner__message">
        {message}
        {cta && (
          <>
            {' '}
            <button
              type="button"
              className="nudge-banner__cta"
              onClick={cta.onClick}
              data-testid={testId ? `${testId}-cta` : undefined}
            >
              {cta.label}
            </button>
          </>
        )}
      </p>
      <button
        type="button"
        className="nudge-banner__close"
        onClick={onDismiss}
        aria-label="Dismiss"
        data-testid={testId ? `${testId}-dismiss` : undefined}
      >
        &times;
      </button>
    </div>
  );
}
