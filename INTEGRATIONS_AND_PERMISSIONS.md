# BaatBanao Integrations and Permissions

## Purpose
This file lists the external APIs, integrations, deployment connections, and sensitive permissions currently used for BaatBanao work. It is meant to be a practical inventory, not a secrets dump.

## Active integrations

### 1) Google Analytics 4 (GA4)
- Measurement ID: `G-VG7Y7ND2PW`
- Used for sitewide analytics and custom event tracking
- Main files:
  - `analytics-config.js`
  - `analytics.js`
  - `app.js`
  - `install.js`
- Current behavior:
  - loads directly without analytics consent gating
  - site keeps only a cookie notice/banner

### 2) Google Search Console API
- Purpose: property access checks, sitemap status checks, and lightweight reporting
- Main script: `seo/gsc_report.py`
- Current property used: `sc-domain:baatbanao.shop`
- Auth model: Google Cloud service account JSON key
- Important note: the uploaded key should be rotated because it was shared in the workspace

### 3) GitHub repository access
- Repo: `anshyd1/baatbanao`
- Purpose: pull/rebase/commit/push deploy workflow
- Current usage: code changes are pushed to the repo, then deployed via Vercel
- Important note: previously shared PAT should be revoked/rotated

### 4) Vercel deployment
- Purpose: hosting and production deploys
- Current usage:
  - serves `https://www.baatbanao.shop`
  - uses `vercel.json` rewrites for clean article URLs
  - serves `404.html`

### 5) OCR engine (Tesseract.js) — SELF-HOSTED
- Version: `tesseract.js` 5.1.1 + `tesseract.js-core` 5.1.1
- Files live in `vendor/tesseract/` and are served from our own origin
- Why self-hosted: the site CSP (`vercel.json`) blocks `cdn.jsdelivr.net` in
  `script-src`, `connect-src` and `worker-src`, so the previous CDN load was
  blocked in production and OCR never ran
- Assets: `tesseract.min.js`, `worker.min.js`,
  `tesseract-core-simd-lstm.wasm.js`, `tesseract-core-lstm.wasm.js`,
  `tessdata/eng.traineddata.gz` (tessdata_fast, ~1.98 MB)
- Worker is created with `workerBlobURL: false` (a `blob:` worker is blocked
  by `worker-src 'self'`)
- Cached by the service worker after first use (`CACHE_OCR` message) so later
  scans work offline
- Privacy: images never leave the device; no data is uploaded

### 6) Browser speech recognition (Web Speech API)
- Used by `voice-ocr.js` for the 🎙️ "bolkar likhein" feature
- Audio is processed by the browser vendor's speech service — **Google** on
  Chrome/Edge/Android, **Apple** on Safari/iOS. This is a third-party
  processor and must stay disclosed in `privacy.html`
- Not available in Firefox (the mic FAB hides itself there)
- Requires HTTPS (`isSecureContext`) and the microphone permission

### 7) GoDaddy DNS
- Purpose: domain and DNS management for `baatbanao.shop`
- Current usage: manual DNS verification/changes
- No GoDaddy API is configured in this workspace right now

### Browser/site permissions or browser APIs used by the app
- **Microphone** — only while the voice assistant is active (see #6)
- **Camera** — via `<input type="file" capture="environment">`; the photo is
  handled as a local file, `getUserMedia` is not used
- Clipboard copy support
- PWA install prompt handling
- Service worker/offline cache
- Local storage for client-side state/features
- Web Share support where available

## Permissions involved

### Google side
- Search Console property access for:
  - `sc-domain:baatbanao.shop`
  - `https://baatbanao.shop/`
- GA4 measurement collection on the public website

### GitHub side
- Repository write access was used to push changes

### Hosting side
- Vercel project deploy access is effectively connected through the GitHub workflow

## Sensitive items that should be rotated
1. Old GitHub PAT
2. Uploaded Google service-account JSON key

## Current tracked GA4 custom events
- `message_generate`
- `template_generate`
- `business_reply_generate`
- `masti_generate`
- `whatsapp_open`
- `copy_text`
- `copy_output`
- `article_copy_click`
- `article_cta_click`
- `related_article_click`
- `whatsapp_link_click`
- `upi_qr_open`
- `upi_qr_share`
- `save_to_khata`
- `quick_khata_add`
- `share_khata_summary`
- `export_khata_csv`
- `khata_remind`
- `pro_checkout_start`
- `pro_unlock_success`
- `install_cta_click`
- `install_prompt_open`
- `install_prompt_result`
- `pwa_installed`
- `voice_command_start`
- `voice_command_parsed`
- `voice_khata_save`
- `voice_khata_update`

## Related docs
- `ANALYTICS_EVENTS.md`
- `SEO_CONTENT_PLAN.md`
- `README.md`
- `seo/gsc_report.py`
