---
name: waving-hand-animation
description: >-
  Add a friendly "waving hand" attention animation to an icon, emoji, or SVG —
  the element scales up, wiggles side-to-side like a real wave, then shrinks
  back and settles (放大 → 揮手 → 縮小歸位), looping with a pause between waves.
  Use this WHENEVER the user wants a hand/emoji/icon to wave, wiggle, or "say
  hi", asks for a 揮手 / 揮手動畫 / 手手動畫 / waving hand, wants to draw
  attention to a call-to-action button (提問/發問/報名/CTA) with a moving icon,
  or describes "放大縮小再歸位", "scale pulse", "wiggle", "attention-grabbing
  icon animation". Works in plain HTML/CSS, React, Vue, Svelte, and Tailwind —
  even if they don't name a framework or say the word "animation" explicitly.
---

# Waving Hand Animation

A small, self-contained CSS technique that makes any icon/emoji/SVG **wave to
grab attention**: it enlarges, rocks side-to-side from the wrist like a real
wave, then shrinks back to its exact original size and position, rests for a
beat, and repeats. Great for CTA buttons (提問、報名、開始) where you want a
playful nudge without a distracting, never-ending jitter.

## The idea (why it works)

A convincing wave is **not** just a spin. Three things sell it:

1. **A wrist pivot.** Real waving rotates from the wrist, not the center. Set
   `transform-origin` near the bottom of the element so the top swings while the
   base stays put.
2. **Damped side-to-side rotation.** The swings get smaller each time
   (−16° → +13° → −9° → +6° → 0°), like a wave losing energy. Equal-sized
   swings read as a mechanical metronome instead.
3. **A rest gap.** The wave happens in the first part of the timeline and the
   rest is held still. This is what makes it feel deliberate ("hello!") rather
   than a twitch that never stops. It's done by putting the resting keyframe at
   a high percentage (e.g. `60%, 100% { … }`).

The scale-up (放大) makes the wave pop; returning to `scale(1) rotate(0)` is the
歸位 — it must land back exactly where it started so the layout doesn't shift.

## Copy-paste recipe (plain HTML/CSS)

Apply the `.wave` class to the element you want to wave. It works on an emoji in
a `<span>`, an `<img>`, or an inline `<svg>`.

```css
.wave {
  display: inline-block;                 /* transforms need a block-ish box */
  transform-origin: 55% 85%;             /* pivot near the wrist (bottom) */
  animation: hand-wave 3.2s ease-in-out infinite;
  will-change: transform;
}

/* 放大 → 揮手 → 縮小歸位, then hold still until the next cycle */
@keyframes hand-wave {
  0%, 60%, 100% { transform: scale(1) rotate(0deg); }   /* rest / 歸位 */
  8%            { transform: scale(1.3) rotate(0deg); }  /* 放大 */
  18%           { transform: scale(1.3) rotate(-16deg); }
  28%           { transform: scale(1.3) rotate(13deg); }
  38%           { transform: scale(1.3) rotate(-9deg); }
  46%           { transform: scale(1.3) rotate(6deg); }
  53%           { transform: scale(1.12) rotate(0deg); } /* 縮小 back down */
}

/* Optional: liven it up when the user hovers the button it lives in */
.cta:hover .wave { animation-duration: 1.1s; }

/* Accessibility: some people get motion sick — honor their OS setting */
@media (prefers-reduced-motion: reduce) {
  .wave { animation: none; }
}
```

```html
<button class="cta">
  <span class="wave">👋</span> 提問
</button>
```

That's the whole thing. Everything below is for tuning it or dropping it into a
framework.

## Tuning guide

Reach for these knobs instead of rewriting the keyframes:

- **Wave more / less often** — change the cycle length (`3.2s`) and/or the rest
  keyframe percentage. The wave occupies `0%`→ the rest keyframe; the remainder
  is the pause. `0%, 60%, 100%` ≈ waves for ~1.9s then rests ~1.3s. Push the
  `60%` higher for a shorter pause, lower for a longer one.
- **Bigger / smaller pop** — adjust `scale(1.3)`. Around `1.2`–`1.4` reads well;
  above `1.5` starts to feel aggressive and can clip against neighbors.
- **Where it pivots** — `transform-origin`. For a hand/emoji the wrist sits low,
  so `55% 85%` (bottom-ish) looks right. A star or bell might pivot from the top
  (`50% 15%`) so it swings like a pendulum.
- **Wave only on hover/focus** (no idle loop) — drop the idle `animation` and
  add it on interaction instead:
  ```css
  .wave { transform-origin: 55% 85%; }
  .cta:hover .wave,
  .cta:focus-visible .wave { animation: hand-wave 1.1s ease-in-out; }
  ```
- **Wave once on page load** then stop — use a non-infinite count:
  `animation: hand-wave 1.3s ease-in-out 1;`

## Framework variants

The technique is framework-agnostic — it's just a class plus keyframes. Match
the host project's styling system rather than importing new tooling.

### React (CSS Modules / plain CSS)
Put the `.wave` rule and `@keyframes` in the component's stylesheet and add the
class: `<span className="wave">👋</span>`. Nothing JS-side is needed for the
idle loop.

### Tailwind
Keyframes belong in `tailwind.config.js` so the animation becomes a utility.
Add under `theme.extend`:

```js
keyframes: {
  'hand-wave': {
    '0%,60%,100%': { transform: 'scale(1) rotate(0deg)' },
    '8%':  { transform: 'scale(1.3) rotate(0deg)' },
    '18%': { transform: 'scale(1.3) rotate(-16deg)' },
    '28%': { transform: 'scale(1.3) rotate(13deg)' },
    '38%': { transform: 'scale(1.3) rotate(-9deg)' },
    '46%': { transform: 'scale(1.3) rotate(6deg)' },
    '53%': { transform: 'scale(1.12) rotate(0deg)' },
  },
},
animation: { 'hand-wave': 'hand-wave 3.2s ease-in-out infinite' },
```

Then: `<span class="inline-block origin-[55%_85%] motion-safe:animate-hand-wave">👋</span>`.
`motion-safe:` gives you the reduced-motion opt-out for free.

### Inline SVG
If the hand is an inline `<svg>`, put the class on the `<svg>` element itself so
the transform applies to the whole drawing. Inlining (rather than `<img>`) is
what lets CSS animate it and lets you keep gradients/fills. Keep
`transform-origin` in the element's CSS, not as an SVG attribute.

## Gotchas

- **The element must be transformable.** Inline elements (`<span>`, `<a>`)
  ignore `transform` until you give them `display: inline-block` (or flex/grid).
- **It must return to the origin exactly.** Always end/rest on
  `scale(1) rotate(0)`. If the final frame differs, the icon will visibly jump
  or nudge neighboring text on every loop.
- **Don't animate layout properties.** Stick to `transform` (and `opacity` if
  you want a fade). Animating width/margin/top causes reflow and jank; `transform`
  is GPU-friendly, which is why `will-change: transform` is included.
- **Respect `prefers-reduced-motion`.** Keep the media-query opt-out — an
  infinitely looping element is exactly the kind of motion that setting exists
  to suppress.

## Live demo

`assets/demo.html` is a standalone, self-contained page showing the wave on an
emoji, on an inline SVG hand, and on a hover-only button. Just open it in a
browser to see the motion and copy whichever variant fits. Point the user there
if they want to preview it before wiring it into their project.
