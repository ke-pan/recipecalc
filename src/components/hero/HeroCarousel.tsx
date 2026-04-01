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

const INTERVAL_MS = 3000;
const TRANSITION_MS = 300;
const TRANSITION_CSS = `transform ${TRANSITION_MS}ms var(--ease-enter), opacity ${TRANSITION_MS}ms var(--ease-enter)`;

type Phase = 'visible' | 'exiting' | 'entering';

const EXIT_STYLE: React.CSSProperties = {
  transform: 'translateY(-100%)',
  opacity: 0,
  transition: TRANSITION_CSS,
};

/** Apply the enter animation using the two-frame rAF technique. */
function animateEnter(el: HTMLElement | null): void {
  if (!el) return;
  el.style.transition = 'none';
  el.style.transform = 'translateY(100%)';
  el.style.opacity = '0';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = TRANSITION_CSS;
      el.style.transform = 'translateY(0)';
      el.style.opacity = '1';
    });
  });
}

export default function HeroCarousel() {
  const [titleIndex, setTitleIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('visible');
  const [reducedMotion, setReducedMotion] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const titleWordRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const advance = useCallback(() => {
    setPhase('exiting');

    setTimeout(() => {
      setTitleIndex((prev) => (prev + 1) % TITLE_WORDS.length);
      setPhase('entering');

      setTimeout(() => setPhase('visible'), TRANSITION_MS);
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
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [advance, reducedMotion]);

  useEffect(() => {
    if (phase === 'entering' && !reducedMotion) {
      animateEnter(titleWordRef.current);
    }
  }, [phase, reducedMotion]);

  const inlineStyle = !reducedMotion && phase === 'exiting' ? EXIT_STYLE : undefined;

  return (
    <section className="hero" aria-label="RecipeCalc hero">
      <div className="hero__content">
        <p className="hero__brand">RecipeCalc</p>

        <h1 className="hero__title">Recipe Cost{'\n'}Calculator</h1>

        <p className="hero__hook">
          Find out what your{' '}
          <span className="hero__rotating-wrapper">
            <span
              ref={titleWordRef}
              className="hero__rotating-word"
              data-testid="title-word"
              style={inlineStyle}
            >
              {TITLE_WORDS[titleIndex]}
            </span>
          </span>{' '}
          really cost.
        </p>

        <p className="hero__desc">
          Free for home bakers, ice cream makers, BBQ pitmasters, caterers,
          and anyone who makes food for a living.
          Add your ingredients, labor, and overhead. See your true cost in minutes.
        </p>

        <a href="/calculator" className="hero__cta">
          Calculate your true cost — free
        </a>

        <div className="hero__badges">
          <span className="hero__badge">
            <span className="hero__badge-icon">&#10003;</span> Free cost breakdown
          </span>
          <span className="hero__badge">
            <span className="hero__badge-icon">&#10003;</span> No account needed
          </span>
          <span className="hero__badge">
            <span className="hero__badge-icon">&#10003;</span> Data stays on your device
          </span>
        </div>
      </div>

      <div className="hero__photo">
        <img
          src="/hero-baking.jpg"
          alt="Baker dusting powdered sugar over muffins and croissants"
          width="480"
          height="640"
          loading="eager"
        />
      </div>
    </section>
  );
}

export { TITLE_WORDS, INTERVAL_MS };
