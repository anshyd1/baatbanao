# AdSense Readiness — BaatBanao

Updated: 28 September 2026 (see the changelog at the bottom)

## Current verdict

Do not apply merely because a page count target has been reached. Google publishes no universal minimum article count or traffic threshold. The site should first show stable, legitimate use and enough original value for review.

## Ready now

- Custom HTTPS domain
- Working mobile navigation and core tool
- About, Contact, Privacy, Terms and Disclaimer pages
- Visible author identity and editorial policy
- Original product functionality, not a content-only shell
- Canonicals, sitemap and Search Console access
- No purchased traffic or click prompts in product copy
- Articles remain in one focused payment-communication topic

## Must be completed before ads go live

1. Obtain AdSense publisher ID, then create a correct `/ads.txt`; never publish a placeholder publisher ID.
2. Use Google Privacy & Messaging or another Google-certified CMP for EEA, UK and Switzerland traffic. The current informational cookie notice is not a certified CMP.
3. Update Privacy Policy with the final AdSense cookie/vendor disclosure once AdSense is configured.
4. Put ads only on content pages initially—not inside generated messages, payment/UPI screens, buttons or khata records.
5. Clearly separate ads from navigation and action controls. Never label an ad as Download, Open UPI, WhatsApp or Continue.
6. Do not ask users to click ads or promise rewards for ad interaction.
7. Monitor invalid traffic. Foreign desktop sessions with zero engagement should not be used to justify ad growth.
8. Review Page Experience after ad code is added; reserve ad dimensions to prevent layout shift.

## Content publishing rule

- No bulk AI/programmatic page publishing.
- Every new page must solve a distinct user problem.
- Include unique examples, practical checks, safety context and a real tool bridge.
- Human review is required before indexing.
- If a page adds no value beyond an existing guide, merge it instead of publishing it.

## Recommended application timing

Reassess after 14–28 days of clean analytics and Search Console data. Apply when core pages are indexed, real India-mobile users use the generator, and there is no unresolved policy/technical issue. Approval is never guaranteed.


## Changelog — 28 September 2026 (approval-readiness pass)

Done in this pass (all 16 guides + 7 info pages, via `seo/enhance_pages.py`):

- Every guide now has an original 1200×630 featured illustration (`/assets/blog/<slug>.jpg`), visible author byline (Ansh Yadav → `/author/ansh-yadav`), published + updated dates and read time, and a visible breadcrumb.
- Article schema upgraded to a Person author, publisher logo, `image`, `dateModified`; BreadcrumbList JSON-LD added on every guide.
- Meta descriptions rewritten to ≤155 characters; `og:image` / `twitter:image` per page.
- Site-wide footer (About · Contact · Privacy · Terms · Disclaimer · Editorial policy · Author · Guides) on every page — previously missing on 5 pages.
- New hub `/guides` (CollectionPage schema) linked from the app drawer and every footer; sitemap regenerated with `lastmod` on all 25 URLs and image entries.
- Privacy policy now carries the AdSense/third-party vendor disclosure (cookies, personalised-ads opt-out links, Google partner-sites policy), Consent Mode note, retention + delete instructions.
- `/upi-payment-link-generator` is a real tool page again (link + QR generated client-side), not a text-only page — original utility helps “low value content” review.
- QR codes are generated on-device (`/vendor/qrcode.js`); no UPI data sent to third-party QR servers (matches the privacy policy).

Still on the owner (cannot be done from code):

1. **ads.txt** — once the publisher ID `pub-XXXXXXXXXXXXXXXX` exists, create `/ads.txt` with exactly:
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
   Do not publish a placeholder ID.
2. **Certified CMP** — enable Google Privacy & Messaging (AdSense → Privacy & messaging → GDPR message) before serving ads to EEA/UK/CH visitors. The current cookie notice is informational only.
3. Place the AdSense snippet only on guide/info pages; keep the app (`/`, `/pay`) ad-free at first.
4. Keep publishing: the 5 planned guides in `SEO_CONTENT_PLAN.md` (salary advance, vendor payment, UPI reminder message, committee/chit, tone examples) go through `python3 seo/generate_pages.py && python3 seo/enhance_pages.py` — add the new slugs to `PAGES` in `enhance_pages.py` and drop a `1200×630` JPG in `assets/blog/`.
