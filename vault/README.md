# BaatBanao Vault

**Visual multi-account balance module for BaatBanao 2.0 — prototype, planning and launch assets.**

Vault shows every account a user holds — cash, bank, UPI wallets, gold and receivables — as eight translucent boxes whose liquid level is the balance. Money pours in, drains out, arcs between boxes and stays frozen while it is still owed. It is designed as the daily-use home tab of BaatBanao, alongside the existing **Khata** (receivables ledger) and **Baat** (reminder messages).

> Naming decision: the master brand stays **BaatBanao**; the feature is **Vault**. Details in [`planning/PRODUCT_PLAN.md`](planning/PRODUCT_PLAN.md).

## Contents

| Path | Description |
|---|---|
| `app/` | Flutter prototype — `lib/main.dart` (physics tray, flick / drag / align / find, pour animation, detail screen with bands, timeline and undo) and the Android build configuration |
| `planning/PRODUCT_PLAN.md` | Product plan: naming decision, structure, integration specification, technical approach, roadmap, metrics, risks |
| `planning/MARKET_RESEARCH.md` | Market context, signals, positioning statement, go-to-market |
| `design/posters/` | Product poster set (feed, feature posters, product shot, web banner, story) + contact sheet |
| `design/sketches/` | Architecture, home wireframe, collection flow, roadmap, naming board, integration map + contact sheet |
| `design/art/` | Text-free poster artwork; `design/make_posters.py` re-renders the set (`FEATURE_NAME` env var) |
| `design/explorations/` | Earlier directions: wave-column storyboard, detail-screen studies, responsive layouts (8 accounts), 3D-cylinder vs ice-cube comparison, demo videos |

## Downloads

| Release | Contents |
|---|---|
| **`vault-v0.3`** (CI build, Phase 1) | `app-arm64-v8a-release.apk` (recommended), `app-armeabi-v7a-release.apk` (32-bit phones), `app-x86_64-release.apk` (emulators), `vault-web.zip` (web bundle). App label: **BaatBanao Vault**. |
| `vault-v0.2` (CI build) | Interaction prototype only (Vault tab, in-memory data). |
| `vault-v0.1` | `BaatBanao_Vault_v0.1_package.zip` — demo videos, web build with one-click local launchers, source and design files. |

All builds are debug-signed test builds. Every push that touches `vault/app/**` is built by **GitHub Actions** (`.github/workflows/build-vault.yml`); pushing a tag `vault-v*` attaches the artifacts to a release.

### What is in v0.3 (Phase 1)

- **Three tabs — Vault · Khata · Baat** — one Flutter codebase for Android and web.
- **Khata** ported from the PWA: add / edit / delete receivables (name, phone, amount, due date, relation, language, tone, note); statuses pending / partial / paid / overdue; reminder counter.
- **Baat** ported from the PWA: reminder composer with 4 languages (Hinglish, Hindi, Bhojpuri, English) × 3 tones (Friendly, Polite, Firm), copy or send via WhatsApp (`wa.me`), optional UPI ID footer.
- **Locked Box (Box 8)** is now derived from the Khata: the sum of outstanding receivables, rendered frosted with a lock; direct edits are refused.
- **"₹ received — which box?"** flow: marking a khata entry paid (or partially paid) thaws the amount out of the Locked Box and pours it into the chosen box; both movements are recorded in the timeline.
- **Local persistence** (`shared_preferences`, key `bb_vault_v1`): balances, timeline, khata and settings survive restarts.
- **Data import**: on the web build, first launch on the same origin as the PWA imports `bb_khata` / `bb_settings` from `localStorage` automatically; on Android, *Khata → menu → Import backup* accepts the PWA's Backup JSON (or a raw `bb_khata` array). *Export* copies a compatible backup to the clipboard.
- Header total counts liquid money only; locked money is shown separately.

## Running the prototype

```bash
cd app
flutter pub get
flutter run                                   # device / emulator
flutter build apk --release --split-per-abi   # Android APKs
flutter build web --release                   # web build (serve with any static server)
```
`android/gradle.properties` is tuned for a 2 GB build machine (`-Xmx560m`, no daemon); raise the heap on a normal workstation.

Source layout: `lib/main.dart` (Vault tray, physics, painter, detail), `lib/store.dart` (persistence + Khata ↔ Locked Box logic), `lib/khata_model.dart`, `lib/khata.dart`, `lib/baat.dart` (templates + WhatsApp), `lib/shell.dart` (tabs), `lib/web_bridge_*.dart` (same-origin `localStorage` import on web). Tests: `flutter test`.

## Status and next steps

| Item | Status |
|---|---|
| Interaction prototype (Flutter) | Complete, compile-verified |
| Test APKs (arm64 / armv7 / x86_64) + web bundle | Built by CI, published in release `vault-v0.3` |
| Product plan, market research | Complete (this folder) |
| Poster and sketch set | Complete (this folder) |
| Phase 1 — Flutter shell (Khata + Baat port, local persistence, import) | **Shipped in v0.3** |
| Phase 2 — Khata → Vault integration (Locked Box, collection pour) | **First cut shipped in v0.3**; polish (undo, month strip, edge cases) next |
| Launch | Diwali 2026 (target 8 November) |

This work lives on the `feat/vault` branch and does not affect the production site deployed from `main`.
