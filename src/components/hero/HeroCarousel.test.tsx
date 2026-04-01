import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import HeroCarousel, { TITLE_WORDS, INTERVAL_MS } from './HeroCarousel';

// Helper to mock matchMedia
function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches,
    addEventListener: vi.fn((_event: string, handler: (e: MediaQueryListEvent) => void) => {
      listeners.push(handler);
    }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return { mql, listeners };
}

describe('HeroCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the initial title word "cookies"', () => {
    render(<HeroCarousel />);
    expect(screen.getByTestId('title-word')).toHaveTextContent('cookies');
  });

  it('renders the product name "RecipeCalc"', () => {
    render(<HeroCarousel />);
    expect(screen.getByText('RecipeCalc')).toBeInTheDocument();
  });

  it('renders the SEO H1 with "Recipe Cost Calculator"', () => {
    render(<HeroCarousel />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/Recipe Cost/);
    expect(h1).toHaveTextContent(/Calculator/);
  });

  it('renders the emotional hook subtitle', () => {
    render(<HeroCarousel />);
    expect(screen.getByText(/Find out what your/)).toBeInTheDocument();
    expect(screen.getByText(/really cost/)).toBeInTheDocument();
  });

  it('renders the CTA link to /calculator', () => {
    render(<HeroCarousel />);
    const cta = screen.getByRole('link', { name: /calculate your true cost/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/calculator');
  });

  it('renders trust badges', () => {
    render(<HeroCarousel />);
    expect(screen.getByText(/Free cost breakdown/)).toBeInTheDocument();
    expect(screen.getByText(/No account needed/)).toBeInTheDocument();
    expect(screen.getByText(/Data stays on your device/)).toBeInTheDocument();
  });

  it('renders the hero photo', () => {
    render(<HeroCarousel />);
    const img = screen.getByAltText('Baker dusting powdered sugar over muffins and croissants');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/hero-baking.jpg');
  });

  it('advances to the next word after the interval', () => {
    render(<HeroCarousel />);
    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[0]);

    // Advance past interval + exit transition + enter transition
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS); // trigger advance
    });
    act(() => {
      vi.advanceTimersByTime(300); // exit transition
    });
    act(() => {
      vi.advanceTimersByTime(300); // enter transition
    });

    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[1]);
  });

  it('cycles title words back to start after reaching the end', () => {
    render(<HeroCarousel />);

    // Advance all at once: TITLE_WORDS.length intervals + transition time
    const totalTime = TITLE_WORDS.length * INTERVAL_MS + 600;
    act(() => { vi.advanceTimersByTime(totalTime); });

    // After cycling through all 8 words, should be back to first
    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[0]);
  });

  it('stops rotation when prefers-reduced-motion is enabled', () => {
    mockMatchMedia(true);
    render(<HeroCarousel />);

    // Stays on first word after multiple intervals
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 5);
    });

    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[0]);
  });

  it('has correct aria-label on the hero section', () => {
    render(<HeroCarousel />);
    expect(screen.getByLabelText('RecipeCalc hero')).toBeInTheDocument();
  });

  it('exports the expected word array', () => {
    expect(TITLE_WORDS).toHaveLength(8);
    expect(TITLE_WORDS[0]).toBe('cookies');
  });
});
