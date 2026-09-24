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
- Current behavior (fixed Sep 2026):
  - loads only after `bb_cookie_consent_v2 === 'accepted'` (see `analytics.js` `shouldLoadGA()`)
  - listens to `bb-consent-accepted` event + `storage` event for cross-tab consent
  - cookie banner (`cookie-banner.js`) re-enabled — bottom sheet, non-blocking, Accept/Reject
  - GA4 `allow_google_signals: false` + `send_page_view: false` (manual page_view)
  - AdSense readiness: for EEA/UK, a Google-certified CMP will be required (currently custom banner — must switch to Google Privacy & Messaging before AdSense)

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

### 5) GoDaddy DNS
- Purpose: domain and DNS management for `baatbanao.shop`
- Current usage: manual DNS verification/changes
- No GoDaddy API is configured in this workspace right now

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

### Browser/site permissions or browser APIs used by the app
- Clipboard copy support
- PWA install prompt handling
- Service worker/offline cache
- Local storage for client-side state/features
- Web Share support where available

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

## Related docs
- `ANALYTICS_EVENTS.md`
- `SEO_CONTENT_PLAN.md`
- `README.md`
- `seo/gsc_report.py`
