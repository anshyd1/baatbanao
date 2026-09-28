# Vault — Market Context and Positioning
Companion to `PRODUCT_PLAN.md` · September 2026

## 1. Category landscape (India)

Personal-finance apps in India fall into two camps:

| Camp | Examples | Model | Weakness for our user |
|---|---|---|---|
| **Automatic (SMS / AA-based)** | Money View, Axio (ex-Walnut), ET Money, INDmoney | Parse bank SMS or use the Account Aggregator framework; monetise through loans, BNPL and mutual funds | Assumes a salaried, bank-first user; Android SMS permission; heavy lending upsell |
| **Manual trackers** | Money Manager (Realbyte), Monefy, Goodbudget, Wallet (BudgetBakers), FinArt | Manual entry; subscriptions or ads | List-and-pie-chart interfaces; English-first; weak cash handling |

Adjacent categories: merchant ledgers (Khatabook, OkCredit — receivables, not own balances) and gamified micro-savings (Jar — 35 M users, 3-D jar filling with coins; Fello, Gullak).

## 2. Signals that matter

1. **Trust gap after loan pivots.** Axio's listing now foregrounds Pay Later and loans; long-time Walnut users publicly look for "just a money manager". A no-loans promise is a differentiator, not a limitation.
2. **Cash + bank + UPI hybrids are underserved.** Tier-2/3 merchants and households hold money in a cash drawer, two bank accounts and two UPI wallets simultaneously. Khata apps track what others owe; PFM apps assume everything is in the bank.
3. **Visual containers are a live trend.** Jar's filling jar and container-style savings UIs prove that a visual metaphor drives engagement; no Indian product applies it to *multiple accounts* at once.
4. **Offline-first, no-login products win in this segment.** Khatabook reached 5 M merchants in nine months with an offline-first ledger; BaatBanao already ships this way.
5. **Manual entry is the main risk** for any tracker. Vault mitigates it by deriving the receivables box automatically from Khata and by routing every collection into a box with one tap.

## 3. Market size (directional)

- India personal-finance software: USD 44.5 M (2025) → USD 65.3 M (2034), CAGR 4.2 % (IMARC).
- Global PFM mobile apps: USD 31.1 B (2025) → USD 202 B (2035), CAGR 20.6 %; budgeting and expense tracking is the largest function; Android leads (MRFR).
- UPI FY 2025-26: 241.6 B transactions (+30 % YoY), ₹31.4 lakh crore — the flows Vault visualises are already digital for most users.

## 4. Positioning statement

> **For** small merchants and households who keep money in cash, bank accounts and UPI wallets at the same time,
> **BaatBanao Vault** is the visual balance module of BaatBanao that shows every account as a container you can see filling and draining,
> **unlike** SMS-driven trackers that sell loans or list-based manual apps built for salaried users,
> **because** it needs no bank login, works offline, links directly to receivables and reminders, and never pushes credit.

## 5. Competitive reference points (Google Play ratings, 2026)

Money Manager 4.6 · Wallet 4.6 · TrackWallet 4.6 · Money View Money Manager 4.8 · Expense Manager (Bishinews) 4.4 · Monefy 3.9–4.1 · Axio 4.1 · Goodbudget 2.8 (Play). Most are free with ads; premium tiers sit at ₹99–₹999 per year. Vault's one-time Pro at ₹99–199 is inside the accepted range.

## 6. Go-to-market

- **Launch hook:** Diwali 2026 / Chopda Pujan — "new books" season for merchants.
- **Channels:** existing BaatBanao traffic and Pro base, CaptionStudio cross-promotion (proven), WhatsApp status creatives, merchant WhatsApp groups in Gorakhpur for a 10-merchant beta, Play Store listing built from the poster set.
- **Message hierarchy:** *Every rupee, in its place.* → one view of cash, bank, UPI and receivables → no loans, no login, works offline.
