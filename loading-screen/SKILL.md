---
name: loading-screen
description: >-
  General, reusable methodology for designing and building loading / 載入 /
  進站 / splash / waiting states in ANY project (React, Vue, Svelte, plain HTML;
  any CSS framework). Use this WHENEVER the user mentions a loading screen,
  splash, spinner, skeleton, progress indicator, 載入中 / 等待中 / 進站畫面, or
  "make a loading" — even if they just say "loading". It picks the right loading
  pattern for the wait, adapts to the host project's own design tokens and brand
  (never imposing a fixed palette or motif), and covers motion, accessibility,
  timing, and clean React / standalone-HTML implementations.
---

# Loading / Waiting States — general playbook

A loading state's job is to reassure the user that the app is working, preserve
context, and reduce *perceived* wait. It is not a place to show off. Match the
host project — a fintech dashboard, a kids' game, and a docs site should each get
a loader that looks like it belongs to them.

## Rule 0 — adapt to the project, don't impose a design

Always derive colours, typography, radius, spacing, and any brand mark from the
**project's existing design system** (CSS variables, Tailwind `@theme` tokens,
brand assets). Do NOT bring a fixed style (specific hues, mascots, radar/star
motifs, etc.). Read the project's tokens first; if it has a logo/brand mark, a
full-screen splash may use it — otherwise stay minimal and neutral.

## Pick the pattern for the *kind* of wait

- **Skeleton screens** — content that will fill a known layout (lists, cards,
  tables, profiles). Best perceived performance; mirror the real layout's shapes.
- **Inline spinner** — short, indeterminate waits scoped to a control/section
  (button submitting, a panel refreshing). Keep it small and local.
- **Progress bar / %** — only when progress is actually measurable (uploads,
  multi-step jobs). Never fake or loop a determinate bar.
- **Branded full-screen splash** — app boot / first paint / heavy route change.
  Brief; use the brand mark; don't block longer than needed.
- **Overlay on existing content (dim ± blur scrim)** — page is already loaded but
  an action is processing; keep the context visible behind the scrim so the user
  keeps their place.

Prefer skeletons/optimistic UI over spinners where a layout is known — they feel
faster. One good indicator beats several stacked "waiting" cues.

## Motion principles

- One primary motion; subtle, smooth, looping (~0.8–2.5s), ease-in-out.
- Don't pile on cues (spinner + bar + pulsing text + dots at once reads as
  anxious). Remove redundancy.
- Animate transform/opacity (GPU-friendly), not layout properties.
- **Always** honour `prefers-reduced-motion: reduce` — swap to a static or
  slow opacity fade; never leave a spinning thing with no fallback.

## Accessibility

- Wrap the loader in `role="status"` with `aria-live="polite"`, or set
  `aria-busy="true"` on the region being loaded.
- Include a visually-hidden text label (e.g. `Loading…` / `載入中`) — an
  animation alone is not announced.
- Don't trap keyboard focus behind a splash; ensure the indicator has enough
  contrast against its background.

## Timing — don't flash, don't overstay

- Remove the loader the instant content is ready.
- For very fast operations, **delay showing** the spinner ~150–200ms so it never
  flashes for sub-perceptible loads.
- If you must avoid flicker on a splash, a ~300–500ms minimum is fine; avoid
  longer artificial delays.
- Localize copy to the app's language; keep it short and honest.

## Implementation — React

```jsx
const [loading, setLoading] = useState(true)
useEffect(() => { /* resolve real work */ setLoading(false) }, [])
// ...
{loading && <Loading />}   // or <Skeleton/> inline where content will land
```

- Put reusable keyframes in the stylesheet (not inline) so variants share them.
- Full-screen splash: `fixed inset-0 z-[100] grid place-items-center`; overlay
  variant adds a translucent scrim + optional `backdrop-blur`.
- Screenshot/verify in a headless preview: boot loaders are brief, so temporarily
  lengthen the timer (e.g. to 20s), capture, then restore the real duration.

## Implementation — standalone HTML

Self-contained single `.html` (full `<!DOCTYPE>`, inline `<style>`, no external
assets) is great for previewing/sharing a loader concept. Serve it via the dev
server (`http://localhost:<port>/<name>.html`) rather than relying on `file://`
double-click, which may not open if `.html` isn't associated with a browser
(dragging the file into a browser also works).

## Neutral, themeable snippets (adopt project tokens — these default to `currentColor` / CSS vars)

```css
/* Spinner */
@keyframes ld-spin { to { transform: rotate(360deg); } }
.ld-spinner { width: 24px; height: 24px; border-radius: 50%;
  border: 2px solid color-mix(in srgb, currentColor 22%, transparent);
  border-top-color: currentColor; animation: ld-spin .8s linear infinite; }

/* Skeleton shimmer — set --sk to a project surface colour */
@keyframes ld-shimmer { to { background-position: -200% 0; } }
.ld-skeleton { border-radius: 8px; background:
  linear-gradient(90deg, var(--sk,#e5e7eb) 25%,
  color-mix(in srgb, var(--sk,#e5e7eb) 55%, #fff) 37%, var(--sk,#e5e7eb) 63%);
  background-size: 200% 100%; animation: ld-shimmer 1.4s ease infinite; }

/* Indeterminate bar */
@keyframes ld-bar { 0%{transform:translateX(-130%)} 100%{transform:translateX(360%)} }
.ld-bar { position:relative; height:4px; border-radius:999px;
  background: color-mix(in srgb, currentColor 12%, transparent); overflow:hidden; }
.ld-bar>i { position:absolute; inset:0 auto 0 0; width:40%; border-radius:999px;
  background: currentColor; animation: ld-bar 1.4s ease-in-out infinite; }

/* Dot pulse */
@keyframes ld-dot { 0%,60%,100%{opacity:.25} 30%{opacity:1} }
.ld-dots i { display:inline-block; width:5px; height:5px; border-radius:50%;
  background: currentColor; margin:0 2px; animation: ld-dot 1.4s infinite; }
.ld-dots i:nth-child(2){animation-delay:.2s} .ld-dots i:nth-child(3){animation-delay:.4s}

@media (prefers-reduced-motion: reduce) {
  .ld-spinner,.ld-skeleton,.ld-bar>i,.ld-dots i { animation: none; }
}
```

Colour these via the project's tokens (set `color`/`--sk` on a parent, or map to
`--text-secondary` / `--surface-2` / the brand accent). Keep them minimal unless
the project's design language calls for something richer.

## Process — mockup first, then implement (default)

Default to showing a preview BEFORE touching app code, so the user approves the
direction first:

1. Read the project's design tokens / brand; note the app's aesthetic + language.
2. Decide the wait type → pick the pattern above.
3. **Show an HTML 示意 first, for approval.** Render a quick preview — an inline
   widget mockup, or a self-contained standalone `.html` — built with the
   project's tokens. Do NOT wire it into the app yet. Wait for the user's OK;
   they'll often request tweaks, so iterate on the mockup until they're happy.
4. Once approved, build the real component using the project's tokens, one
   primary motion, a reduced-motion fallback, and an aria label.
5. Wire the loading state; ensure it clears when work is done (delay-show if the
   op is fast).
6. Verify visually; keep / offer the standalone HTML for sharing.

Skip the mockup step (go straight to step 4) only if the user explicitly says
"just build it" / "直接做" / gives a design that's already locked.
