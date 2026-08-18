# Handoff: South Beach trip app → GitHub Pages

## Overview
A single-page trip planner for a Miami Beach / Art Deco District trip. Three tabs (List,
Map, Base), an install/"add to home screen" sheet, and a hidden "Flamingo mode" Miami Vice
theme behind the flamingo icon in the header. Everything is client-side; there is no
backend and no build step.

## About the design files — READ THIS FIRST
Unlike most design handoffs, **this bundle is a working static site, not a mock to be
recreated**. It runs directly in a browser from the filesystem and is intended to be
deployed to GitHub Pages essentially as-is. Do not port it to a framework, do not add a
bundler, and do not rewrite the markup — the goal is deployment, not reimplementation.

Fidelity: **high** — final colors, type, spacing, timings. Treat every number as
intentional; the animation timings in particular were tuned by hand over many passes.

## What's in this bundle

| File | Role |
| --- | --- |
| `index.html` | The app. Byte-identical copy of `South Beach.dc.html`, renamed so GitHub Pages serves it as the site root. **This is the file to deploy.** |
| `South Beach.dc.html` | The original source filename, kept for traceability with the design tool. Safe to delete from the repo. |
| `support.js` | Runtime the HTML file loads (`<script src="./support.js">`). Required — must sit next to `index.html`. |
| `map-view.js` | `<map-view>` custom element wrapping Leaflet. Lazy-loads Leaflet 1.9.4 from unpkg with SRI hashes. |
| `places.json` | All content: the base address plus the place list (categories, walk/drive times, lat/lng, notes). Fetched at runtime. |
| `palm-sky.jpg` | Palm-tree backdrop for the List tab in Flamingo mode. |
| `flamingo.png` | Header icon; tapping it toggles Flamingo mode. |
| `manifest.json` | Web app manifest. Relative `start_url`/`scope` so it works from a repo subpath. |
| `sw.js` | Service worker: precaches the app shell, stale-while-revalidate for fonts/Leaflet/tiles. |
| `.nojekyll` | Disables Jekyll processing on GitHub Pages. |
| `icon.svg`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | App icons, wired up via the manifest and `apple-touch-icon`. |

Everything is referenced with relative paths, so the site works from a repo subpath
(`https://<user>.github.io/<repo>/`) with no changes.

## Deploying

1. Copy the bundle contents to the repo root (or to `/docs`).
2. Delete `South Beach.dc.html` if you want a single entry point.
3. `.nojekyll` is already included — keep it at the repo root so Pages skips Jekyll.
4. Settings → Pages → Deploy from branch → `main` / root (or `/docs`).
5. Verify on the live URL, not just locally: `places.json` is fetched with
   `cache: "no-cache"`, and file:// origins block that fetch in some browsers.

## PWA status — done, but verify on the live URL

The manifest, icons, iOS meta tags, and service worker are all wired up in the
`<helmet>` block at the top of `index.html`. Nothing further is required to ship.

Two things to check once deployed:

1. **Install prompt.** On Android/Chrome, DevTools → Application → Manifest should show no
   errors and offer install. On iOS, Share → Add to Home Screen should launch full screen
   with no browser bars.
2. **Offline.** Load the site, then go offline and reload. The List tab must render from
   cache. The Map and Base tabs will show an empty map pane on a cold cache — Leaflet and
   the CARTO/OSM tiles are CDN-loaded, and only tiles already viewed are cached. If full
   offline maps matter, vendor Leaflet locally and decide on an explicit offline state for
   those two tabs.

**When you change any precached file, bump `CACHE` in `sw.js`** (currently `"sobe-v1"`).
Otherwise returning visitors keep the old shell. The worker registration is deliberately
skipped when the page runs inside an iframe, so the design tool's preview never serves
stale files; it registers normally on a real deployment.

## Third-party dependencies (all CDN, all optional to vendor)
- **Google Fonts:** Archivo (variable width/weight), Public Sans, DM Mono, plus Limelight,
  Poiret One, Josefin Sans, Cinzel, Monoton for the Flamingo-mode title options.
- **Leaflet 1.9.4** from unpkg, with SRI hashes in `map-view.js` — if you vendor it
  locally, keep or update the hashes.
- **Basemap tiles:** CARTO `light_all`, falling back to OpenStreetMap. Both require
  attribution, which the map already renders. Check tile-usage policies before any
  real traffic.

If offline fidelity matters, vendor the fonts and Leaflet into the repo rather than
caching third-party origins in the service worker.

## Design tokens
Both themes are defined as CSS custom properties in the `<style>` block at the top of
`index.html`. Regular ("deco") values are the fallbacks in each `var(--token, fallback)`
call; Flamingo ("vice") values are the `[data-theme="vice"]` block. Do not hard-code
colors anywhere — every surface reads a token so the theme flips in one place.

Key values:
- Chrome base navy `#10243A` (sits permanently under the header/nav gradient so a theme
  swap never exposes the shell behind it)
- Deco accent `#F2A007`, teal `#0E7C7B`
- Vice: void `#0E0022`, bg `#1A0736`, card `#2A0B4E`, accent `#FF3D8B`, cyan `#22E4DC`,
  header gradient `linear-gradient(168deg, #2B0446, #6C1163 46%, #C42A6E 78%, #FF6B3D)`
- `--cardR: 0px` in Vice (cards, install sheet, and guide cards go square; chips and
  buttons stay rounded via `--r: 11px`)

## Behavior worth preserving (easy to break)
- **Theme swap:** the outgoing wordmark is snapshotted into an absolutely-positioned ghost
  layer that fades out via the `ghostOut` keyframe while the new title is already at full
  opacity behind it — there is never a frame where the title is dim. The new title then
  rebuilds letter by letter, S first (2.5s per letter, 0.05s apart, ease-out-expo);
  restarting the run relies on alternating between the identical `letterInA`/`letterInB`
  keyframes, which is why there are two.
- **Card shadow:** suppressed entirely during the theme swap with `box-shadow 0s` so the
  halo cuts instantly rather than animating down from full strength; it eases back in over
  0.85s once the swap window (560ms) ends.
- **Card entrance:** cards stay hidden until the List section's slide-in transform
  finishes (370ms), because a transformed ancestor suppresses `backdrop-filter` and the
  Vice card blur would otherwise settle late.
- **List scroll:** tapping the List tab resets scroll to top even when already on List, as
  does switching category filters.
- **Data loading:** one silent retry, then a `Try again` button — never an indefinite
  "loading" state.

## Content
All copy that isn't chrome lives in `places.json`. Editing the trip means editing that
file; no code changes needed. The base address (1330 Ocean Drive) appears in the install
sheet footer and in the Base tab.
