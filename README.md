# Lumiere Magazine — Flipbook (self-contained PWA)

An interactive, page-turning flipbook of the **Lumiere digital magazine** (COMPLETE edition, 92 pages).
Everything it needs lives in this folder — no CDNs, no external services, no build step.
It also installs as a **mobile app** (Add to Home Screen) and works offline after the first load.

## What's inside
- `index.html` — the page (+ PWA meta, service-worker registration)
- `flipbook.css` — styling (responsive: 2-page spread on desktop, single page on phones)
- `flipbook.js` — behavior (page count, controls, keyboard, rebuilds on rotate)
- `vendor/page-flip.browser.js` — StPageFlip engine (MIT), bundled locally
- `manifest.webmanifest` + `icons/` — makes it installable as an app
- `sw.js` — service worker (offline cache of the shell + pages)
- `pages/page-001.jpg … page-092.jpg` — one image per magazine page
- `vercel.json` — cache headers for Vercel

## Mobile / app
- **Phones:** single-page view, swipe to turn, auto-switches on rotate.
- **Install:** open the site → browser menu → *Add to Home Screen* / *Install app*.
  It then opens fullscreen like a native app and works offline.

## Run locally
```
python -m http.server 8001 -d .
```
then open http://localhost:8001  (a server is needed so the service worker works)

## Hosted on (either works forever — you own both)
- **GitHub Pages** — from the repo `vaanyashivkumar/lumiere-magazine-complete`
- **Vercel** — static deployment of this same folder

To move hosts, just upload this folder again. Nothing is locked to one provider.

## Update the magazine
Re-render new page images into `pages/` (same `page-###.jpg` names). If the page count
changes, update `PAGE_COUNT` in `flipbook.js`. Then bump `CACHE` in `sw.js` and redeploy.
