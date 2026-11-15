---
name: "trend-detective-design-system"
description: "Trend Detective's Lusion-derived design system: exact tokens, motion curves, timings and component recipes. Use for any UI, styling or animation work on the Trend Detective site."
---

# Trend Detective design system

The design system for Trend Detective (NASA Space Apps 2026, "Be an Earth System Trend Detective"; Next.js + Tailwind on Vercel). Its motion was measured from a teardown of lusion.co: their stylesheet's 75 transition rules, their JS bundle, and frame-by-frame samples of live animations. The full reference with live component previews is the Claude Design system **"Trend Detective"**: https://claude.ai/artifact/Anodt34ZbSdzxnBWeWrHm8 (read `project/README.md`, `project/motion.md`, `project/tokens.json`, `project/components/bundle.css` and `bundle.js` there if you can open it). This skill holds everything needed even when you can't.

It is a study of how Lusion moves, not a copy: no Lusion logo, "L" mark, 3D assets, copy or licensed fonts. Aeonik is replaced by Inter Tight and their pixel face by Silkscreen.

## Principles

1. **One curve family.** Use only the easing tokens below. If something feels off, change the duration or delay, never invent a curve.
2. **Things wait their turn.** Fills arrive 300ms after the dot that announces them, arrows after their label, and menu cards leave in reverse order.
3. **Things travel, and text stays readable.** Arrows exit while a twin enters, and labels nudge to make room. **Never duplicate text just to animate it.** Lusion's same-text roll (label slides up, identical copy slides in) reads as flicker and was removed at the user's request. A roll is allowed only when the words actually change (Menu → Close).
4. **Pointer-driven motion is damped, not timed:** `x = lerp(x, target, 1 - Math.exp(-k * dt))`.
5. **Chapters change the room.** Night and Paper chapters, plus per-case themes.
6. **Spectacle carries evidence.** Every big moment must explain the data.

## Tokens (paste as tokens.css)

```css
:root, [data-theme='night'] {
  --ground:#07090d; --ground-raised:#12151c; --ground-sunken:#0b0d12; --tint:#1a2340;
  --ink:#f3f4fa; --ink-muted:#a3a6b3; --ink-faint:#4a4e5c; --hairline:#262a35;
  --slate:#2b2e3a; --on-slate:#ffffff;
  --accent:#36f1cd; --accent-ink:#04140f; --accent-wash:#36f1cd1f;
  --warming:#ff8a3d; --cooling:#5b93ff; --false-alarm:#e879f9; --no-trend:#6b7080;
}
[data-theme='paper'] {
  --ground:#f0f1fa; --ground-raised:#ffffff; --ground-sunken:#e4e6ef; --tint:#c9d3ff;
  --ink:#0a0b0f; --ink-muted:#55586a; --ink-faint:#a9adbf; --hairline:#d3d6e3;
  --slate:#2b2e3a; --on-slate:#ffffff;
  --accent:#36f1cd; --accent-ink:#04140f; --accent-wash:#36f1cd2e;
  --warming:#d9520b; --cooling:#1f5fe0; --false-alarm:#a723c4; --no-trend:#7a7e8f;
}
:root {
  --space-1:4px; --space-2:8px; --space-3:15px; --space-4:20px; --space-5:30px; --space-6:60px; --space-7:120px; --space-8:160px;
  --radius-sm:10px; --radius-md:15px; --radius-lg:18px; --radius-pill:999px;
  --ease-lusion:cubic-bezier(.35,0,0,1); --ease-ui:cubic-bezier(.4,0,.1,1);
  --ease-expo:cubic-bezier(.16,1,.3,1); --ease-loop:cubic-bezier(.1,0,.1,1); --ease-back:cubic-bezier(0,1.3,1.1,1);
  --dur-micro:100ms; --dur-fast:200ms; --dur-ui:300ms; --dur-base:400ms; --dur-panel:500ms; --dur-hold:600ms; --dur-reveal:1000ms; --dur-loop:3000ms;
  --delay-fill:300ms; --delay-icon:200ms; --stagger-panel:45ms; --stagger-word:70ms;
  --tilt:3.5deg; --rise:96px; --shift:1.5em;
  --grid-gap:4vw; --cross-size:clamp(.875rem,1vw,2rem); --pill-height:44px;
  --font-display:"Inter Tight","Helvetica Neue",Arial,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,monospace;
  --font-pixel:Silkscreen,"IBM Plex Mono",monospace;
}
```

Colour rules:
- **Night** is the default theme; `data-theme="paper"` is for light chapters.
- `accent` is the single interactive accent. Use it as a fill with `accent-ink` text, never as text on the ground.
- Data colours (`warming`, `cooling`, `false-alarm`, `no-trend`) are for data only, always labelled, and identical in every case theme.
- The preloader and page wipe are pure black and white in both themes.
- All text pairs above meet 4.5:1, and data colours meet 3:1 for graphics.

## Type

Load the fonts with next/font/google: Inter Tight 400/500, IBM Plex Mono 400/500, Silkscreen 400.

| Style | Font | Size / line / tracking |
|---|---|---|
| display-xl | display 400 | 120 / 114 / -2.4px |
| display-l | display 400 | 96 / 96 / -1.92px |
| display-m | display 400 | 48 / 54 / -0.48px |
| title | display 400 | 26 / 30 |
| lead | display 400 | 20 / 24 |
| body | display 400 | 16 / 22 (60ch max) |
| label | display 500, UPPERCASE | 14 / 16 (buttons, nav) |
| mono-label | mono | 12 / 16, tracking 0.48px, tabular figures |
| mono-micro | mono 500, UPPERCASE | 10 / 12 |
| pixel-label | pixel | 12 / 16, tracking 1px (loading and stamps only) |

Voice: plain and short. Questions as titles, verdicts as stamps (PASSED / NOT PROVEN). Uppercase micro-labels for metadata (`CASE 001 · MERRA-2 · AIR TEMPERATURE`). Zero-padded counts (`001`). One tagline sentence in the header. No emoji, no exclamation marks.

## Layout

- 12 columns with a 4vw gap and a 15px page gutter.
- The hero sits in an inset `radius-sm` card with a row of + registration marks beneath it and a mono `SCROLL TO EXPLORE`.
- Radii: 10 for panels, 15 for media, 18 for inputs, pill for every button.
- Floating cards are **solid** (`ground-raised`), not frosted. Glass is only allowed for nav floating over the globe.
- Big headlines indent their second line.
- Icons: only text arrows (→ ↗ ↑ ↓), dots (• ••), + crosses and pixel numerals. No icon library.

## Motion: measured values

- Curves: `ease-lusion` (57 rules on lusion.co; their code names it `lusion()`) for CTAs, floods and transitions. `ease-ui` (58 rules) for header, menu and arrows. `ease-expo` for underlines and headline reveals. `ease-loop` for loops only. `ease-back` for small stamps only.
- 300 / 400 / 500ms cover 82% of transitions. Hover-in can be ceremonial (fill 500ms after a 300ms wait); hover-out is quick (200ms, no delay).
- Damping k: 12 for smooth scroll, 10 for card hovers, 7 for counters.
- Motion (motion.dev): `transition={{ duration: 0.4, ease: [0.35, 0, 0, 1] }}`. The other curves are `ui [0.4,0,0.1,1]`, `expo [0.16,1,0.3,1]` and `loop [0.1,0,0.1,1]`.
- Anime.js: `ease: 'cubicBezier(.35,0,0,1)'`.
- Keep native scroll and use `useScroll` + `useTransform` for the few pinned moments.

## Components (behaviour recipes)

- **PillButton (dot flood):** `[dot][label][arrow]`, height 44, pill, `overflow:hidden`. On hover:
  - The dot runs `translateX(3em) scale(32)` and turns `accent` (400ms `ease-lusion`).
  - The background turns `accent` after `--delay-fill` (500ms `ease-lusion`).
  - The label moves -1em and the arrow slides in from `translateX(2.6em)` (400ms `ease-ui`).
  - Hover-out on the background is 200ms with no delay. Use one per view.
- **ShiftButton (nav pills):**
  - Slate "OPEN A CASE": the background turns accent, the label moves +1.1em and the arrow enters from -2.2em (300ms `ease-ui`). The dot scales to 0 in 100ms.
  - Light "MENU ••": the dots rotate 270° (400ms).
- **RollLink (menu/list links):** an `accent-wash` pill fades and scales .94 → 1 (300/400ms). The label runs `translateX(6px)` (400ms `ease-ui`). The arrow goes from -6px and transparent to in place, 60ms later. The current page shows • and doesn't nudge. **No duplicate label.**
- **ArrowButton:** a 44px circle. The arrow exits along its own direction (`translate(1.6em,-1.6em)` for ↗, -2.2em for ↑) while an `aria-hidden` twin enters from the opposite side (300ms `ease-ui`).
- **UnderlineLink:** a 1px `::before` with `scaleX` 0 → 1. Origin is right at rest and left on hover (300ms `ease-expo`).
- **MenuStack:**
  - Three separate solid cards: links, one live fact (e.g. "8,834 places with a real trend") and a dark slate outbound card.
  - Closed: card 1 at `translateY(var(--rise)) rotate(3.5deg)`, cards 2–3 at `translateY(calc(var(--rise)*1.3)) rotate(-3.5deg)`, opacity 0.
  - Opening: 500ms `ease-ui`, 45ms apart. Closing runs in reverse.
  - The Menu label rolls to CLOSE (allowed, because the words change; stack both labels in one grid cell so CLOSE isn't clipped).
  - Close on Escape and on outside click.
- **HeadlineReveal:** split into words, each in an `overflow:hidden` mask. Line 1 words start at `translateY(100%)` and line 2 words at `-100%`. Each animates to 0 over 1000ms `ease-expo`, 70ms apart. Run once at ~15% into view, at most one per screen.
- **CaseCard:**
  - Rounded media (15px) showing the case's real chart: trend line in warming or cooling, dashed `no-trend` if not proven.
  - A mono tag line, then a 26px title.
  - Hover: title letters slide 34px in a wave, damped k=10, with later letters starting first (12ms apart), and the arrow chases ~100ms behind. The media scales 1.04 over 800ms.
  - Keep the damping loop running until all delays have passed, or it stops on the first frame.
- **Preloader** (only while real data loads):
  - Black screen, a 120px bar filling white, and a 3-digit odometer bottom-left.
  - Each digit is damped k=7 toward `floor(p*100/10^(n-i-1))` and drawn between floor and ceil so it rolls.
  - Keep drawing until every digit lands on 100.
  - The bar then splits and folds into a check (600ms `ease-lusion`), with a pixel "DATA READY" stamp on `ease-back`.
  - Show for at least 600ms; give it `role="progressbar"`.
- **PageWipe:** two black slabs rotated -24° sweep in (700ms `ease-lusion`, the second +80ms). A pixel LOADING holds while content swaps under cover, then the slabs exit on the far side. Under 1.6s total, between whole pages only.
- **HeroFrame:** the globe in an inset `radius-sm` card, with five + marks (three on mobile) and a centred mono SCROLL TO EXPLORE.
- **CheckCards:**
  - The four checks (Wobble, Shuffle, Many places, Over time) as playing cards: name and pixel numeral top, an evidence ledger, a PASSED stamp, and the name mirrored at the foot.
  - Dealt from a face-down stack with `rotateY(180deg → 0)`, 900ms `ease-lusion`, 90ms apart.
  - A failed check shows NOT PROVEN in `ink-muted`, never red.
- **Ledger:** a big caption with a pixel glyph and a count, then hairline rows: label, zero-padded mono count, description. Rows tint `accent-wash` on hover.
- **CaseTheme:** each case sets `--case-bg`, `--case-text`, `--case-highlight`, `--case-btn-bg` and `--case-btn-text`, transitioning over 500ms `ease-lusion`. The themes are Arctic ice (#0b1626 / #e8f1ff / #7cc4ff), Beijing haze (#1d1a14 / #f6ead2 / #e3a12f) and Murray-Darling rust (#24140f / #ffeadb / #ff7a45). It only tints the page; data colours never change.
- **ContinueCue:** a pill whose arrows drop with `@keyframes {0%{translateY(0)} 33%,100%{translateY(1em)}}` (3s `ease-loop`, infinite, second arrow +300ms). **The text stays still.** Place it above a "next case" ending.

## Non-negotiables

- Wrap every hover in `@media (hover: hover)`. `:focus-visible` shows the arrived state plus a 2px `accent` ring.
- `prefers-reduced-motion`: transitions become 1ms and loops stop. Reveals, deals and wipes go straight to the end state.
- Charts are flat 2D on an opaque panel, with no blur, glass or grain behind numbers. Counters land exactly on the true value.
- Twins (arrows, the Close label) are `aria-hidden`. Content must be readable with JS off.
- Keep data credits (NASA MERRA-2 via GES DISC, NOAA CPC) and the AI-use note visible in the footer.
- Hackathon priority order: tokens + fonts + buttons/links, then header/menu, then case cards + check cards, then the rest. Build and check a mobile width after each step.