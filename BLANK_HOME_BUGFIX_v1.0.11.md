# 🐛 Blank Home Page Bugfix — v1.0.11

**Date:** 3 July 2026
**Reported:** "Chat nhi connect ho rha... other browser status" + screenshot showing
blank home page with only topbar/bottom-nav visible, on a slow connection
(1-15 KB/s shown in status bar).

## Root cause (confirmed by reproducing on a throttled connection)

Three separate issues stacked on top of each other, all triggered by slow
networks (2G/3G, common for this app's audience on budget phones):

### 1. Firebase SDK (~880 KB) loaded eagerly on every page, blocking Home
`firebase-config.js` was imported unconditionally via
`<script type="module">` on every single page load — even though it's
only needed for the Chat feature. `firebase-app.js` + `firebase-auth.js`
+ `firebase-firestore.js` + `firebase-database.js` total ~880 KB. At
15 KB/s that's **45-60+ seconds** competing for bandwidth with the
scripts/styles that actually build the Home page.

**Fix:** New `lazy-firebase.js` loads Firebase dynamically — immediately
if the user lands on `#chat`/`#connect`, otherwise deferred until the
browser is idle after first paint (`requestIdleCallback`). It never
blocks Home's critical path again.

### 2. Blocking stylesheets held up `<script defer>` execution
`install.css` and `chat-styles.css` (not needed for Home's first paint)
were loaded as regular blocking `<link rel="stylesheet">` tags. Browsers
hold `<script defer>` execution until *all* earlier blocking stylesheets
finish downloading — so on a slow connection, `app.js` (which builds the
whole Home page) couldn't run until multiple unrelated CSS files finished
downloading first, one after another.

**Fix:** `install.css` and `chat-styles.css` now load non-blocking via
the `media="print" onload="this.media='all'"` trick, with a `<noscript>`
fallback. `style.css` (needed immediately) stays blocking on purpose —
it's small and prevents flash-of-unstyled-content.

### 3. Splash screen hid on a fixed timer, not when the app was actually ready
The splash screen used a flat `setTimeout(..., 3000)` to remove itself,
with zero awareness of whether `app.js` had actually finished loading and
rendering Home yet. On a slow connection, the splash disappeared right on
schedule while `#content` was still empty — revealing a blank page below
the static topbar/bottom-nav. This is exactly the bug in the screenshots.

**Fix:** Splash now polls `#content` and only hides once it has real
content rendered, with a 1.4s minimum hold (keeps the intentional brand
moment on fast connections) and a 6s maximum cap (so a truly broken load
never traps the user behind the splash forever).

### Bonus: oversized images that made everything worse
`mascot-coin.png` (191 KB) was marked `fetchpriority="high"` and
preloaded — on a slow connection this alone can take 12+ seconds and
steals bandwidth from the CSS/JS needed for first paint. Converted to
WebP: **191 KB → 19 KB**. `vasooli-hero-banner.webp` was also resized
down (source was oversized for how it's actually displayed):
**104 KB → 35 KB**. Old duplicate PNG mascot files (already flagged as
debt in the handoff doc) were removed.

## Net effect

- Home page now renders as soon as `app.js` + `style.css` arrive — no
  longer waits behind Firebase, `install.css`, or `chat-styles.css`.
- Chat still works exactly the same; Firebase just loads a beat later
  (imperceptible on normal connections, and forced immediately if the
  user goes straight to Chat).
- ~250 KB less to download before the app is usable on a first visit.

## Files changed
- `index.html` — script tags (`defer` + reordered), stylesheet loading
  strategy, splash-hide logic, updated image references
- `app.js` — force-loads Firebase immediately on Chat navigation
- `chat-ui.js` — updated `mascot-coin.png` → `.webp` reference
- `lazy-firebase.js` — **new file**, lazy Firebase loader
- `service-worker.js` — cache list updated (webp mascot, lazy-firebase.js), version bump
- `install-preview.html` — updated mascot reference for consistency
- `assets/mascot-coin.png` → `assets/mascot-coin.webp` (191 KB → 19 KB)
- `assets/vasooli-hero-banner.webp` — resized (104 KB → 35 KB)
- Removed unused duplicate PNG mascot files

## How it was verified
Reproduced the exact bug first (blank home page) by throttling network to
~15 KB/s via Chrome DevTools Protocol — matched the screenshots. Then
verified the fix removes the blank window at that same throttled speed,
and confirmed normal-speed load + full chat flow still work correctly.
