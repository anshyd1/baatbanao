# Reliability and privacy regression suite

Run from the repository root (Node 18+ and Python 3.10+):

```sh
python -m pip install -r tests/reliability/requirements.txt
python -m playwright install --with-deps chromium
node tests/reliability/test_runtime.cjs
python tests/reliability/test_browser.py
python tests/reliability/test_payment_regression.py
python tests/reliability/test_finance_browser.py
```

Expected current totals: **79 runtime + 53 browser/content + 63 payment regression + 67 finance/download = 262 assertions**.

The browser suite intercepts the production hostname and serves the local repository with the candidate Vercel header configuration. It is **not a deployed-site test**. Service workers are blocked in these browser tests; their cache/activation behavior is tested separately in the Node VM. Vercel header precedence still requires production verification after release.

Internet access is needed for the real Google tag, pinned Tesseract worker/model/WASM, and Flutter CanvasKit. Google collection requests are intercepted and fulfilled locally; test events are not sent to the analytics property. Inputs are synthetic. Real OCR is exercised, with separate simulated dependency-failure and cancellation tests. The font fixture expects DejaVu Sans (provided by Chromium's Linux dependencies).

Enhanced measurement must remain disabled on the GA4 stream: the test checks that the real tag does not add unsafe automatic form/outbound events. No Google credential or GitHub credential is used by these tests. Nothing resets a real user's storage or sends a WhatsApp message or payment.

Evidence is written under ignored `results/`. All 262 checks passed on 7 October 2026 in headless Chromium (audit-fixes branch: OCR/mic P1 remediation). New coverage since the v2.0.0 audit: OCR due-date label/ISO parsing and merchant-phone rejection (checked against real Tesseract runs on all four shipped sample bills), voice date/amount separation and compound Hinglish-Devanagari amounts, paise preservation, the mandatory pre-send review gate, mic language-fallback and cancel event ordering, offline cached-engine loading, service-worker OCR-cache preservation, and ledger clear/undo reconciliation. Native Android/iOS app launches, physical-device camera capture, handwritten OCR accuracy, and native share sheets are not certified by this suite.

The finance suite covers duplicate receipt isolation, paise rounding, invoice item validation, stale payment edits, 301-record retention, quota failure, a real generated PDF, advance/return/undo/delete accounting, matching-name ledger retention, and download API failure/partial/unsafe-response cases. `--live` tests actual site responses with synthetic isolated local data; download API failure cases remain deliberately simulated. APK endpoint range checks do not certify signing or physical-device installation.
