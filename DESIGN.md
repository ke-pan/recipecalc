# Design System — RecipeCalc

## Product Context
- **What this is:** A "pricing therapist" for home bakers — a guided wizard that reveals the gap between ingredient cost and true cost, then recommends a selling price
- **Who it's for:** Home bakers, cottage food operators, small bakeries — mostly female, 25-45, discovers via Reddit/Facebook on mobile
- **Space/industry:** Food cost calculators. Competitors: BakeProfit, meez, recipecostcalculator.net, DishTrack, foodmaths
- **Project type:** Hybrid — marketing hero + interactive wizard tool (Astro + React islands)

## Aesthetic Direction
- **Direction:** Organic/Natural — "A sun-warmed kitchen notebook turned into a gentle intervention"
- **Decoration level:** Intentional — typography and whitespace do most of the work; subtle paper texture; one hero photo
- **Mood:** Warm, trustworthy, empowering. Like a trusted friend who's also good with numbers. NOT corporate, clinical, or SaaS-like.
- **Reference sites:** None in our category — we deliberately break from every competitor's visual language (no purple/blue/pink SaaS palettes)
- **Hero photography:** One high-quality overhead kitchen/baking photo on landing page hero only. Requirements: warm tones, natural light, overhead angle, low saturation to blend with parchment palette. Wizard steps remain clean and photo-free.

## Typography
- **Display/Hero:** Fraunces (variable, weight 600) — warm, human, slightly culinary serif. Carries seriousness without being corporate. Optical sizing and softness axes provide versatility.
- **Body:** DM Sans (variable, weight 400-600) — clean geometric sans with warm feel. Better mobile readability than a serif body. Wide letterforms at small sizes.
- **UI/Labels:** DM Sans (weight 500-600, 12-13px, uppercase + letter-spacing for section labels)
- **Data/Tables:** Geist Mono (weight 400-500) — modern monospace with excellent tabular-nums. Used for all cost figures, percentages, and pricing. The numbers must feel honest and inspectable.
- **Code:** Geist Mono
- **Loading:** Google Fonts CDN — `Fraunces:ital,opsz,wght@0,9..144,300..900` + `DM+Sans:wght@400..600` + `Geist+Mono:wght@400..600`
- **Scale:**
  - xs: 11px / 0.6875rem — swatch labels, fine print
  - sm: 13px / 0.8125rem — captions, field labels, muted text
  - base: 16px / 1rem — body text, input values
  - lg: 20px / 1.25rem — step titles (Fraunces)
  - xl: 24px / 1.5rem — section headings (Fraunces)
  - 2xl: 32px / 2rem — hero subheadings (Fraunces)
  - 3xl: 36px / 2.25rem — hero headline, recommended price (Fraunces)
  - display: 48px / 3rem — landing page hero (Fraunces, with rotating text)

## Color
- **Approach:** Restrained — one accent + warm neutrals + two semantic colors. Color is rare and meaningful.
- **Palette:**

```css
:root {
  /* Neutrals — warm kitchen palette, never cold white or pure black */
  --bg: #F6F0E7;              /* Oat-paper background */
  --surface: #FFF9F2;          /* Raised recipe-card surface */
  --text-primary: #2F241D;     /* Deep roasted-brown */
  --text-muted: #736357;       /* Soft cocoa */
  --border: #E8DFD3;           /* Warm border */
  --border-subtle: #F0E8DC;    /* Faint separator */

  /* Semantic — each has a specific emotional role */
  --accent: #B85C38;           /* Baked terracotta — CTAs, progress, key actions */
  --caution: #C96A2B;          /* Cinnamon orange — "you're underpricing" moments, hidden gap */
  --confidence: #4E7A5D;       /* Herb green — recommended price, "you can do this" */

  /* Reveal-specific */
  --reveal-bg: #F2EDE4;        /* Slightly warmer bg for reveal step */
}
```

- **Usage rules:**
  - Accent is for **action**, not decoration. CTAs, progress markers, interactive elements.
  - Caution appears only when **surfacing hidden costs or emotional friction**. The "gap" color.
  - Confidence appears at the **end of the flow as earned relief**. The recommended price, the "you're not alone" message. Never used throughout — it's a reward.
  - Never use color alone to convey meaning — always pair with text labels (WCAG compliance).

- **Dark mode:**

```css
[data-theme="dark"] {
  --bg: #1C1917;
  --surface: #292524;
  --text-primary: #F5F0EB;
  --text-muted: #A8A29E;
  --accent: #D4845A;
  --caution: #E0884A;
  --confidence: #6B9E7D;
  --border: #3D3733;
  --border-subtle: #332E2A;
  --reveal-bg: #252220;
}
```

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — generous whitespace, especially around the reveal moment
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Vertical rhythm:** Uneven — roomy intro, tighter math areas, dramatic breathing pause before reveal

## Layout
- **Approach:** Hybrid — editorial hero for landing page, wizard-worksheet for calculator
- **Grid:** Single column on mobile (375px), centered max-width 640px on desktop
- **Max content width:** 640px
- **Border radius:**
  - sm: 4px — input fields, small chips
  - md: 8px — buttons, alerts, gap bar
  - lg: 10px — reveal boxes, ingredient rows
  - xl: 12px — cards, main surfaces
  - 2xl: 16px — mockup containers, wizard frame
- **Wizard layout:** Persistent header (logo + step dots), main content area (no card borders), fixed-bottom CTA on mobile. Step 4a uses `--reveal-bg` background to visually distinguish the reveal moment.

## Motion
- **Approach:** Intentional — only 3 deliberate animations, everything else is instant
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(100ms) short(200ms) medium(300ms) long(500ms)
- **The 3 intentional animations:**
  1. **Hero title rotation:** Product/role text cycles every 3s with slide-up/slide-down (300ms ease-out)
  2. **Step transition:** Content slide-left + fade (200ms ease-out) forward, reverse for backward
  3. **Reveal sequence:** Spinner 300ms → skeleton shimmer 400ms → left box fade-in 200ms → 150ms gap → right box fade-in 200ms → numbers count-up 500ms → gap bar slide-in 200ms → price scale-up 300ms
- **Respects `prefers-reduced-motion`:** All animations disabled, count-up shows final number, title rotation stops on first item

## Anti-Slop Commitment
This design system explicitly rejects:
- Purple/violet/indigo gradients (meez does this)
- Pink/rose accent palettes (BakeProfit does this)
- Blue "trust" palettes (recipecostcalculator.net does this)
- 3-column feature grids with icons in colored circles
- Centered everything with uniform spacing
- `system-ui`, `Inter`, `Roboto`, `Arial` as font choices
- Decorative blobs, floating circles, wavy SVG dividers
- Uniform border-radius on all elements
- Generic hero copy ("Welcome to...", "The all-in-one...")
- Stacked cards of identical style for every section

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system | Created by /design-consultation. Three-voice consensus (Claude + Codex + Claude subagent) on organic/natural aesthetic with warm kitchen palette. |
| 2026-03-26 | Fraunces heading + DM Sans body | Fraunces: warm variable serif, modern. DM Sans: better mobile readability than serif body (Newsreader). Geist Mono for data (cleaner than IBM Plex Mono). |
| 2026-03-26 | Parchment bg #F6F0E7 | Deliberate departure from all competitors' white backgrounds. Three-voice consensus. |
| 2026-03-26 | Terracotta/Sage color system | Every competitor uses blue/purple/pink. Earth tones signal "kitchen, not office." Three-voice consensus. |
| 2026-03-26 | Hero photography | One high-quality overhead kitchen photo on landing page only. Wizard steps stay clean. User requested; constrained to hero to avoid readability issues. |
| 2026-03-26 | No handwritten fonts | Caveat was proposed by Claude subagent for "therapist voice" microcopy. Rejected — risk too high for trust-building product. |
