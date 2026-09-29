# Vault — Product Plan
**BaatBanao 2.0 · Visual multi-account balance module**
Version 1.1 · 28 September 2026 · Status: Planning approved for build

---

## 1. Executive summary

BaatBanao today helps small merchants and individuals *collect* money: polite WhatsApp payment reminders in four languages, an Udhaar Khata (receivables ledger), UPI payment links and QR codes. What it does not yet show is the user's own money.

**Vault** closes that gap. It presents every account a user holds — cash, bank accounts, UPI wallets, gold and money owed to them — as eight translucent boxes whose liquid level is the balance. Incoming money pours in, spending drains out, transfers arc between boxes, and receivables sit *frozen* until they are collected. The result is a daily-use screen that turns BaatBanao from an occasional utility into a habit.

| Decision | Outcome |
|---|---|
| Brand | **BaatBanao remains the master brand.** No rename. |
| Feature name | **Vault** — "BaatBanao Vault". The working codename *PaaniKhata* and the interim name *Tijori* are retired. |
| Product structure | Three modules under one roof: **Vault · Khata · Baat**. Vault becomes the home tab. |
| Platform | One Flutter codebase for Android (APK / Play) and Web; the existing PWA is frozen and migrated. |
| Launch window | **Diwali 2026 (target: 8 November 2026)**, aligned with Chopda Pujan — the traditional opening of new account books. |

---

## 2. Naming and brand decision

### 2.1 Why the app is not renamed
- *BaatBanao* carries the equity: the `baatbanao.shop` domain, indexed SEO landing pages, the Pro/VIP pass and cross-promotion from CaptionStudio.
- The phrase ("make it work out") is broad enough to cover money management, not only reminders.
- A rename resets brand recognition to zero for no functional gain.

### 2.2 Why "Vault"
| Criterion | Vault |
|---|---|
| Voice | Professional English, consistent with a premium product line |
| Comprehension | Universally understood in India through "bank vault" and "locker"; no explanation needed |
| Scope | A vault holds *all* money — cash, bank and UPI — not just a cash drawer |
| Brevity | One syllable; reads cleanly in UI labels, notifications and voice commands ("Open Vault") |
| Visual identity | Maps directly to the box/cube icon and the ice-cube interaction model; the frosted "locked" box is literally a vault compartment |
| Availability | No dominant Indian consumer-finance product uses "Vault" as its primary brand (verify trademark class 9/36 before launch) |

### 2.3 Alternatives considered
| Name | Verdict | Reason |
|---|---|---|
| Tijori | Retired | Regional; not aligned with the professional English brand voice adopted for 2.0 |
| Treasury | Rejected | Corporate / government tone; heavy for a merchant audience |
| Reservoir | Rejected | Fits the liquid metaphor but low comprehension in the target market |
| Wallet | Rejected | Saturated category term; implies small sums |
| Cashbox / Galla | Rejected | Cash-only connotation |
| Balance Board | Reserve | Descriptive fallback if validation fails |
| PaaniKhata | Retired | Reads as a water-utility ledger; duplicates "Khata" already used in-app |

### 2.4 Naming conventions
- Product line: **BaatBanao 2.0 — Vault**
- Feature: **BaatBanao Vault**; individual containers are **Box 1 – Box 8**; the receivables container is the **Locked Box**
- Tagline: *Every rupee, in its place.*  Secondary: *Your money, in clear view.*
- Regional copy variants (Hindi, Bhojpuri, Hinglish) are produced in Phase 4 for local campaigns; the product name stays "Vault" in all languages.
- Validation: before lock-in, ask ten target users what "Vault" means to them; proceed if at least seven answer "a place where money is kept safely". Fallback: Balance Board.

---

## 3. Product structure

```
                        BAATBANAO 2.0
   ┌────────────────┬────────────────┬────────────────────┐
   │  VAULT (home)  │     KHATA      │        BAAT        │
   │  8 balance     │  Receivables   │  Reminder messages │
   │  boxes, flows, │  ledger:       │  4 languages,      │
   │  find, detail  │  pending /     │  UPI link + QR,    │
   │  (new)         │  partial / paid│  bulk queue        │
   └────────────────┴────────────────┴────────────────────┘
```

- **Home tab = Vault.** Balances are checked daily; reminders are sent occasionally. Landing on Vault maximises daily opens, which drives retention and, later, Pro conversion.
- **Box 8 = Locked Box (receivables).** The total of pending entries in Khata is rendered as a *frosted* cube — money that belongs to the user but cannot yet be spent. This reuses the ice-cube system's "frozen = locked" convention.
- Default seed configuration (editable): 1 SBI · 2 HDFC · 3 Cash · 4 PhonePe · 5 Paytm · 6 ICICI · 7 Gold · 8 Locked (receivables). Free tier: 5 boxes; Pro: 12.

---

## 4. Integration specification

### 4.1 Event → behaviour
| Trigger (existing module) | Vault behaviour | Motion |
|---|---|---|
| New credit entry saved in Khata | Box 8 level rises | Frost forms |
| Reminder sent from Baat | Chip on Box 8: "3 reminders pending" | Soft pulse |
| Entry marked **Paid** | Sheet: "₹500 received — which box?" (Cash / PhonePe / bank) | Box 8 thaws; liquid arcs into the chosen box |
| Entry marked **Partial** | Proportional thaw and transfer | Same, scaled |
| Month rollover | Strip: *In · Out · Collected* for the month | — |
| Find (# key or voice) | Target box glows; others dim | Ramp + haptic |

### 4.2 Data model (offline-first, no login)
```
accounts[]  { id, name, type, color, balance, goal, minLimit, order, locked }   // locked = true for Box 8
txns[]      { id, accId, type: in | out | transfer, amt, note, cat, ts, pairId,
              source?: { kind: 'collection', khataId } }
khata[]     { id, customer, phone, amount, paid, status: pending | partial | paid,
              dueDate, lang, templateId }                                          // existing
reminders[] { id, khataId, sentAt, channel, templateId }                          // existing
settings    { theme, lang, pro, homeTab: 'vault' }
```
Rules: the cash box cannot go negative; deletions are soft (30-day recovery) with a 5-second undo; Box 8 is derived from Khata and is not directly editable.

### 4.3 Interaction model (from the prototype)
Physics tray (flick with friction and wall bounce, long-press drag, spring "Align"), number/voice **Find**, tap-to-open detail (65 % column / 35 % timeline, IN bands and OUT notches, swipe-to-delete with undo) and a 1.3-second pour animation on every incoming amount. Rate-limited haptics on Android.

---

## 5. Technical approach

| Area | Decision | Rationale |
|---|---|---|
| Framework | Flutter (Dart) — single codebase | Smooth 60 fps physics, haptics, one build for APK, Play and Web |
| Existing PWA | Frozen (bug fixes only); Khata and Baat re-implemented in Flutter | CRUD + templates, estimated 2–3 weeks |
| Storage | Hive (local; encrypted box optional) | Offline-first, consistent with BaatBanao's no-login principle |
| Migration | Web build served on the same origin reads legacy `localStorage` and imports automatically; APK users import a JSON backup exported from the PWA | Zero-effort upgrade for web users |
| Distribution | Signed APK on baatbanao.shop + Google Play (internal → production); web app at `app.baatbanao.shop` | APK is primary on low-bandwidth networks; web serves desktop |
| Build hygiene | Release keystore, code shrinking on, split-per-ABI APKs (arm64, armeabi-v7a) | Size and compatibility |

The prototype in `app/` compiles cleanly on Flutter 3.47 and ships as a debug-signed arm64 test APK (release `vault-v0.1`). The test build still carries the prototype label; the next build is labelled "BaatBanao Vault".

---

## 6. Roadmap

| Phase | Window | Scope | Exit criteria |
|---|---|---|---|
| 0 · Naming & design | 29 Sep – 5 Oct | Lock name and tagline; align the eight box colours with BaatBanao's brand palette; final poster set | Assets approved |
| 1 · Flutter shell | 6 – 19 Oct | 3-tab navigation; port Khata and Baat (templates × 4 languages, UPI link + QR, bulk queue); Hive; JSON import | Feature parity with the PWA |
| 2 · Integration | 20 – 26 Oct | Locked Box 8, "which box?" sheet, thaw-and-pour transfer, reminder chip, monthly strip | §4.1 table passes QA |
| 3 · Release | 27 Oct – 2 Nov | Keystore, Play listing, screenshots, `app.baatbanao.shop`, upgrade banner on the PWA | Play internal test + web live |
| 4 · Launch | 3 – 8 Nov | Poster series, WhatsApp status campaign, CaptionStudio cross-promo, 10-merchant beta in Gorakhpur | 100 installs in week 1 |

Post-launch (v2.1): goals and minimum-balance alerts, CSV export, dark theme, 12-box Pro tier.

---

## 7. Monetisation and principles

- **Free:** 5 boxes, unlimited Khata, all Baat templates. Ads remain on template screens only — **never inside Vault**; trust is the product.
- **Pro (existing pass, extended):** 12 boxes, goals and alerts, dark theme, CSV export, custom colours. One-time ₹99–199; existing Pro users upgraded free.
- **Never:** lending, BNPL or loan lead-generation. The strongest signal in the research is the exodus of users from trackers that pivoted to loans.

---

## 8. Success metrics

| Metric | Target (90 days post-launch) |
|---|---|
| D1 / D7 retention | 45 % / 25 % |
| Users with ≥ 3 boxes configured | 60 % of actives |
| Paid-marked Khata entries routed to a box | 70 % |
| Median daily opens per active user | ≥ 1.5 |
| Pro conversion (30-day cohort) | 3 % |
| Crash-free sessions | 99.5 % |

---

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Two codebases during transition | Divergent bugs | Freeze the PWA; time-box the port to three weeks |
| Manual-entry fatigue | Low retention | Make Khata → Vault automatic (§4.1); keep entry to two taps; voice input |
| Flutter web payload on slow networks | Drop-off | APK first on mobile; web positioned for desktop; deferred loading |
| Name comprehension | Weak adoption | Ten-user validation (§2.4); Balance Board fallback |
| Scope creep before Diwali | Missed window | Only §4.1 items ship in 2.0; everything else is v2.1 |

---

## 10. Deliverables in this section

| Path | Content |
|---|---|
| `app/` | Flutter prototype (source, Android build configuration) |
| `planning/PRODUCT_PLAN.md` | This document |
| `planning/MARKET_RESEARCH.md` | Market context and positioning |
| `design/posters/` | Product poster set (feed, feature posters, product shot, web banner, story) |
| `design/sketches/` | Architecture, home wireframe, collection flow, roadmap, naming board, integration map |
| `design/explorations/` | Earlier design directions, responsive layouts, 3D comparison, demo videos |
