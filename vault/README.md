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
| **`vault-v0.2`** (CI build) | `app-arm64-v8a-release.apk` (recommended), `app-armeabi-v7a-release.apk` (32-bit phones), `app-x86_64-release.apk` (emulators), `vault-web.zip` (web bundle). App label: **BaatBanao Vault**. |
| `vault-v0.1` | `BaatBanao_Vault_v0.1_package.zip` — demo videos, web build with one-click local launchers, source and design files. |

All builds are debug-signed test builds; data is held in memory. Every push that touches `vault/app/**` is built by **GitHub Actions** (`.github/workflows/build-vault.yml`); pushing a tag `vault-v*` attaches the artifacts to a release.

## Running the prototype

```bash
cd app
flutter pub get
flutter run                                   # device / emulator
flutter build apk --release --split-per-abi   # Android APKs
flutter build web --release                   # web build (serve with any static server)
```
`android/gradle.properties` is tuned for a 2 GB build machine (`-Xmx560m`, no daemon); raise the heap on a normal workstation.

## Status and next steps

| Item | Status |
|---|---|
| Interaction prototype (Flutter) | Complete, compile-verified |
| Test APKs (arm64 / armv7 / x86_64) + web bundle | Built by CI, published in release `vault-v0.2` |
| Product plan, market research | Complete (this folder) |
| Poster and sketch set | Complete (this folder) |
| Phase 1 — Flutter shell (Khata + Baat port, Hive, import) | Next |
| Phase 2 — Khata → Vault integration | Planned |
| Launch | Diwali 2026 (target 8 November) |

This work lives on the `feat/vault` branch and does not affect the production site deployed from `main`.
