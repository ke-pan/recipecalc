import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import HeroCarousel, { TITLE_WORDS, SUBTITLE_WORDS, INTERVAL_MS } from './HeroCarousel';

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

  it('renders the initial subtitle word "Home Bakers"', () => {
    render(<HeroCarousel />);
    expect(screen.getByTestId('subtitle-word')).toHaveTextContent('Home Bakers');
  });

  it('renders the product name "RecipeCalc"', () => {
    render(<HeroCarousel />);
    expect(screen.getByText('RecipeCalc')).toBeInTheDocument();
  });

  it('renders the CTA link to /calculator', () => {
    render(<HeroCarousel />);
    const cta = screen.getByRole('link', { name: /calculate your true cost/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/calculator');
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
    expect(screen.getByTestId('subtitle-word')).toHaveTextContent(SUBTITLE_WORDS[1]);
  });

  it('cycles title words back to start after reaching the end', () => {
    render(<HeroCarousel />);

    // Each interval fires advance(), which uses setTimeout(300) + setTimeout(300)
    // We need to advance through TITLE_WORDS.length intervals.
    // Advance all at once: TITLE_WORDS.length intervals + transition time
    const totalTime = TITLE_WORDS.length * INTERVAL_MS + 600;
    act(() => { vi.advanceTimersByTime(totalTime); });

    // After cycling through all 8 words, should be back to first
    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[0]);
  });

  it('subtitle cycles independently from title', () => {
    render(<HeroCarousel />);

    // Advance through all subtitle words (5 items)
    for (let i = 0; i < SUBTITLE_WORDS.length; i++) {
      act(() => {
        vi.advanceTimersByTime(INTERVAL_MS);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
    }

    // Subtitle should be back to first, title should be at index 5
    expect(screen.getByTestId('subtitle-word')).toHaveTextContent(SUBTITLE_WORDS[0]);
    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[5]);
  });

  it('stops rotation when prefers-reduced-motion is enabled', () => {
    mockMatchMedia(true);
    render(<HeroCarousel />);

    // Stays on first word after multiple intervals
    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 5);
    });

    expect(screen.getByTestId('title-word')).toHaveTextContent(TITLE_WORDS[0]);
    expect(screen.getByTestId('subtitle-word')).toHaveTextContent(SUBTITLE_WORDS[0]);
  });

  it('renders static text around the rotating words', () => {
    render(<HeroCarousel />);
    expect(screen.getByText(/are your/i)).toBeInTheDocument();
    expect(screen.getByText(/really making money/i)).toBeInTheDocument();
  });

  it('has correct aria-label on the hero section', () => {
    render(<HeroCarousel />);
    expect(screen.getByLabelText('RecipeCalc hero')).toBeInTheDocument();
  });

  it('exports the expected word arrays', () => {
    expect(TITLE_WORDS).toHaveLength(8);
    expect(SUBTITLE_WORDS).toHaveLength(5);
    expect(TITLE_WORDS[0]).toBe('cookies');
    expect(SUBTITLE_WORDS[0]).toBe('Home Bakers');
  });
});
