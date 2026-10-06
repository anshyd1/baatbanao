# BaatBanao

BaatBanao is a lightweight PWA for generating polite, funny, and professional WhatsApp payment reminders in Hinglish, Hindi, Bhojpuri, and English.

## Live
- Primary: https://www.baatbanao.shop
- Apex redirect: https://baatbanao.shop

## Features
- Vasooli Mode for quick reminder generation
- Udhaar Khata with pending / partial / paid tracking
- Smart templates for friends, clients, rent, tuition, and shop udhaar
- Bulk reminder queue
- UPI pay link + QR support
- Installable PWA with offline cache

## Tech
- Plain HTML, CSS, and JavaScript
- No backend required
- Vercel deployment

## Project files
- `index.html` — main app shell
- `app.js` — SPA logic (exposes `window.state` etc. for standalone modules)
- `style.css` — UI styling
- `service-worker.js` — offline cache
- `manifest.json` — PWA manifest
- `*.html` — SEO landing pages
- `voice-ocr.js` — 🎙️ voice assistant + 📷 bill/parchi OCR scanner
- `vendor/tesseract/` — self-hosted OCR engine (see below)

## Voice + OCR (voice-ocr.js)

Two client-side features, no backend and no API cost:

- **🎙️ Bolkar likhein** — Web Speech API (`hi-IN`, falls back to `en-IN`).
  Chrome/Edge/Chrome-Android and Safari 14.5+ only; the mic button hides
  itself where unsupported (Firefox). Audio is processed by the browser
  vendor's speech service, which is disclosed in `privacy.html`.
- **📷 Bill / parchi scanner** — Tesseract.js running in a Web Worker.

The OCR engine is **self-hosted in `vendor/tesseract/`**, not loaded from a
CDN: the site CSP (`vercel.json`) blocks third-party script/connect/worker
sources, and a CDN load was blocked in production. It is served from our own
origin, works offline after the first scan (the service worker caches it),
and needs no SRI pinning.

Re-fetch/upgrade the engine with:

```bash
bash tools/update-tesseract.sh
```

Then bump `CACHE_VERSION` in `service-worker.js` and the `?v=` query on
`voice-ocr.js` in `index.html`.

Accuracy note: preprocessing (grayscale → autocontrast → upscale → unsharp)
matters far more than the model. Measured on the four shipped sample bills,
amount extraction went from **1/4 to 3/4** with the better pipeline, and the
10.9 MB "standard" language model gave **no** accuracy gain over the 1.98 MB
`tessdata_fast` one. Parsed amounts that look implausible are flagged in the
UI so a bad OCR digit can never silently become a wrong WhatsApp reminder.

## Local run
Because this is a static app, you can serve it with any local static server. Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## SEO pages pipeline

Guide pages are generated, never hand-edited:

```bash
python3 seo/generate_pages.py   # writes the 16 Hinglish guide pages (source of truth: this script)
python3 seo/enhance_pages.py    # post-processor: breadcrumb + byline + featured image + schema + footer + /guides hub + sitemap.xml
```

`enhance_pages.py` is idempotent (it strips its own marked blocks before re-inserting), so run it after every `generate_pages.py` run.
Featured images live in `assets/blog/<slug>.jpg` (1200×630); the shared article stylesheet is `blog.css`.

## Deployment notes
- Preferred canonical domain: `https://www.baatbanao.shop`
- `robots.txt` and `sitemap.xml` are configured for the custom domain
- Utility payment page `/pay` is marked `noindex`

## License
Private / not specified.


## Analytics setup
1. Open `analytics-config.js`
2. Paste your GA4 Measurement ID in `ga4MeasurementId`
3. Deploy/push
4. Analytics will load automatically for the site

Example:

```js
window.BAATBANAO_ANALYTICS = {
  ga4MeasurementId: 'G-XXXXXXXXXX',
  requireConsent: false
};
```


## Search Console helper
Use `seo/gsc_report.py` to generate a quick Search Console status report from a service-account JSON key.

Example:

```bash
python3 seo/gsc_report.py --credentials /path/to/service-account.json --site sc-domain:baatbanao.shop
```

## 404 page
A custom `404.html` is included for broken links and unknown routes.

## Analytics docs
- `analytics.js` contains the GA4 loader and sitewide click tracking
- `ANALYTICS_EVENTS.md` lists the tracked custom events
- `SEO_CONTENT_PLAN.md` lists article expansion ideas
- `INTEGRATIONS_AND_PERMISSIONS.md` lists external APIs, integrations, permissions, and rotation-sensitive access currently involved in the project
