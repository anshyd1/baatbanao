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
- `app.js` — SPA logic
- `style.css` — UI styling
- `service-worker.js` — offline cache
- `manifest.json` — PWA manifest
- `*.html` — SEO landing pages

## Local run
Because this is a static app, you can serve it with any local static server. Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

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
