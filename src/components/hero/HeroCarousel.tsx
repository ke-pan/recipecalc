import { useState, useEffect, useCallback, useRef } from 'react';

const TITLE_WORDS = [
  'cookies',
  'cupcakes',
  'cakes',
  'bread',
  'ice cream',
  'BBQ',
  'pies',
  'pastries',
] as const;

const SUBTITLE_WORDS = [
  'Home Bakers',
  'Cottage Food Sellers',
  'Food Truck Owners',
  'Small Bakeries',
  'Caterers',
] as const;

const INTERVAL_MS = 3000;
const TRANSITION_MS = 300;

type Phase = 'visible' | 'exiting' | 'entering';

export default function HeroCarousel() {
  const [titleIndex, setTitleIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('visible');
  const [reducedMotion, setReducedMotion] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const advance = useCallback(() => {
    // Phase 1: slide old word up (exit)
    setPhase('exiting');

    // Phase 2: after exit animation, swap word and slide new word in
    setTimeout(() => {
      setTitleIndex((prev) => (prev + 1) % TITLE_WORDS.length);
      setSubtitleIndex((prev) => (prev + 1) % SUBTITLE_WORDS.length);
      setPhase('entering');

      // Phase 3: word is now visible
      setTimeout(() => {
        setPhase('visible');
      }, TRANSITION_MS);
    }, TRANSITION_MS);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(advance, INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [advance, reducedMotion]);

  const getTransformStyle = (phase: Phase): React.CSSProperties => {
    if (reducedMotion) {
      return { transform: 'translateY(0)', opacity: 1 };
    }
    switch (phase) {
      case 'exiting':
        return {
          transform: 'translateY(-100%)',
          opacity: 0,
          transition: `transform ${TRANSITION_MS}ms var(--ease-enter), opacity ${TRANSITION_MS}ms var(--ease-enter)`,
        };
      case 'entering':
        return {
          transform: 'translateY(0)',
          opacity: 1,
          transition: `transform ${TRANSITION_MS}ms var(--ease-enter), opacity ${TRANSITION_MS}ms var(--ease-enter)`,
        };
      case 'visible':
      default:
        return { transform: 'translateY(0)', opacity: 1 };
    }
  };

  // When entering, start from below (translateY(100%)) with no transition,
  // then animate to translateY(0). We handle this by setting initial position.
  const getWordStyle = (): React.CSSProperties => {
    if (reducedMotion) {
      return {
        display: 'inline-block',
        transform: 'translateY(0)',
        opacity: 1,
      };
    }
    if (phase === 'entering') {
      // Animate from below to center
      return {
        display: 'inline-block',
        ...getTransformStyle('entering'),
      };
    }
    return {
      display: 'inline-block',
      ...getTransformStyle(phase),
    };
  };

  // For the entering phase, we need to first set position to below
  // then trigger animation. We use a ref + requestAnimationFrame approach.
  const titleWordRef = useRef<HTMLSpanElement>(null);
  const subtitleWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (phase === 'entering' && !reducedMotion) {
      // First frame: position below without transition
      const titleEl = titleWordRef.current;
      const subtitleEl = subtitleWordRef.current;
      if (titleEl) {
        titleEl.style.transition = 'none';
        titleEl.style.transform = 'translateY(100%)';
        titleEl.style.opacity = '0';
      }
      if (subtitleEl) {
        subtitleEl.style.transition = 'none';
        subtitleEl.style.transform = 'translateY(100%)';
        subtitleEl.style.opacity = '0';
      }
      // Next frame: animate to final position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (titleEl) {
            titleEl.style.transition = `transform ${TRANSITION_MS}ms var(--ease-enter), opacity ${TRANSITION_MS}ms var(--ease-enter)`;
            titleEl.style.transform = 'translateY(0)';
            titleEl.style.opacity = '1';
          }
          if (subtitleEl) {
            subtitleEl.style.transition = `transform ${TRANSITION_MS}ms var(--ease-enter), opacity ${TRANSITION_MS}ms var(--ease-enter)`;
            subtitleEl.style.transform = 'translateY(0)';
            subtitleEl.style.opacity = '1';
          }
        });
      });
    }
  }, [phase, reducedMotion]);

  return (
    <section className="hero" aria-label="RecipeCalc hero">
      <p className="hero__brand">RecipeCalc</p>

      <h1 className="hero__title">
        Are your{' '}
        <span className="hero__rotating-wrapper">
          <span
            ref={titleWordRef}
            className="hero__rotating-word"
            data-testid="title-word"
            style={phase !== 'entering' ? getWordStyle() : { display: 'inline-block' }}
          >
            {TITLE_WORDS[titleIndex]}
          </span>
        </span>
        <br />
        really making money?
      </h1>

      <p className="hero__subtitle">
        For{' '}
        <span className="hero__rotating-wrapper">
          <span
            ref={subtitleWordRef}
            className="hero__rotating-word hero__rotating-word--subtitle"
            data-testid="subtitle-word"
            style={phase !== 'entering' ? getWordStyle() : { display: 'inline-block' }}
          >
            {SUBTITLE_WORDS[subtitleIndex]}
          </span>
        </span>
      </p>

      <a href="/calculator" className="hero__cta">
        Calculate your true cost — free
      </a>
    </section>
  );
}

export { TITLE_WORDS, SUBTITLE_WORDS, INTERVAL_MS };
