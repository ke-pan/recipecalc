/**
 * PaywallCard — inline dashed-border card shown to free users in Step 4b.
 *
 * Displays a feature list, $19 one-time price, "Get Your Price" CTA that
 * opens LemonSqueezy checkout, and an "Already have a key?" link to /activate.
 *
 * Design: dashed border inline card (not a modal). See RFC 5.5 and DESIGN.md.
 */

import { useRef, useEffect } from 'react';
import { useLemonCheckout } from '../../hooks/useLemonCheckout.js';
import { trackEvent, EVENTS } from '../../lib/analytics';
import './paywall.css';

export interface PaywallCardProps {
  /** LemonSqueezy checkout URL (from PUBLIC_LS_CHECKOUT_URL). */
  checkoutUrl: string;
}

const FEATURES = [
  'Recommended pricing + slider',
  'Save unlimited recipes',
  'Copy & export results',
] as const;

export default function PaywallCard({ checkoutUrl }: PaywallCardProps) {
  const { openCheckout } = useLemonCheckout();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        trackEvent(EVENTS.PAYWALL_VIEW);
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleClick = () => {
    trackEvent(EVENTS.PAYWALL_CLICK);
    openCheckout(checkoutUrl);
  };

  return (
    <div className="paywall-card" data-testid="paywall-card" ref={cardRef}>
      <h3 className="paywall-card__title">
        Unlock Full Pricing &mdash; $19
      </h3>
      <p className="paywall-card__subtitle">
        one-time, not a subscription
      </p>

      <ul className="paywall-card__features">
        {FEATURES.map((feature) => (
          <li key={feature} className="paywall-card__feature">
            <span className="paywall-card__check" aria-hidden="true">&#x2713;</span>
            {feature}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="paywall-card__cta"
        onClick={handleClick}
        data-testid="paywall-cta"
      >
        Get Your Price &rarr;
      </button>

      <p className="paywall-card__activate">
        Already have a key?{' '}
        <a href="/activate" data-testid="paywall-activate-link">/activate</a>
      </p>
    </div>
  );
}
