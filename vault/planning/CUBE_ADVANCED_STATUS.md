# BaatBanao Vault — Cube Advanced v0.4 Status

**Reference:** User-provided screenshot from the current app, 29 Sep 2026.
**Important:** This is the original playable cube/tray product — not a vertical liquid-bar dashboard.

## What the screenshot confirms is already working

- Eight separate translucent ice/glass cubes.
- Liquid level inside each cube.
- Physics tray with rotation, bump and flick behaviour.
- Long-press drag interaction.
- `Align` action.
- `Find box` action.
- Tap a cube → account detail screen.
- `+ Aaya` and `− Kharch` actions.
- Bottom navigation: Vault · Khata · Baat.
- Locked Khata/Udhaar cube.
- Cube numbers and account labels.
- Haptic feedback exists in the current physics code.
- Local persistence, Khata and Baat are already present in the Flutter app.

## What is genuinely pending

| Priority | Feature | Current state | Estimate |
|---|---|---|---:|
| P0 | Flexible box count | **Implemented:** active and archived cubes are user-managed; existing stable numbers are preserved | Done |
| P0 | Add box | **Implemented:** name, type, colour, goal, low-balance threshold and optional opening transaction | Done |
| P0 | Edit box | **Implemented:** detail overflow and Manage boxes editor; current balance/history are preserved | Done |
| P0 | Archive/delete box | **Implemented:** zero-balance archive and history-aware safe delete rules | Done |
| P0 | Per-box menu | **Implemented:** detail overflow plus Manage boxes action menu | Done |
| P0 | Full entry form | **Expanded:** amount, box, date, category, person/source/vendor and note; immediate safe undo is available | Done |
| P1 | Transfer | **Implemented:** source → destination flow with paired timeline IDs and balance-safe validation | Done |
| P1 | Transaction edit/reverse/undo | **Implemented first slice:** save snackbar can reverse a just-created entry/paired transfer safely | Done for first slice |
| P1 | 3–4 finger multi-touch | **Implemented:** pointer-specific map controls independent cubes; tap, flick, long-press and physics remain | Done |
| P1 | Alerts | **Implemented:** low-balance Alerts screen plus safe-delete/locked-box notices | Done for first slice |
| P1 | Sound | **Implemented first slice:** optional system click feedback; haptics remain configurable | Done for first slice |
| P1 | Preferences | **Implemented:** sound, haptics, reduce-motion, low-balance and overdue warning toggles | Done |
| P2 | Box search/filter | `Find box` exists; management search/filter missing | 0.5 day |
| P2 | Goal and low-balance rules | **Implemented in box editor/model:** goal never drops below current balance; optional low-balance threshold is persisted | Done |
| P2 | Accessibility | Text scaling, keyboard focus and reduced motion need a pass | 1 day |
| P2 | Migration tests | Persistence/import exists; v0.4 schema migration tests are needed | 1 day |
| P2 | Release QA | Android + web + small-screen + offline test pass | 2 days |

## Recommended build order

### Phase 1 — Box manager and menu — 2–3 days

Add a top-right menu and `Manage boxes` screen without changing the cube tray.

```text
Menu
├── Add new box
├── Manage / reorder boxes
├── Activity
├── Alerts
├── Backup & import
└── Preferences
```

Each cube gets a `⋮` menu:

```text
Add money
Spend money
Transfer
Edit box
Reorder
Archive
Delete
```

### Phase 2 — Add/edit/delete — 2 days

- User can keep 2, 5, 8 or more boxes according to the configured limit.
- Existing seeded boxes are not deleted or renamed during migration.
- New boxes get a stable ID, colour, icon, goal and opening transaction.
- Current balance is never overwritten silently.
- Non-zero boxes are archived or emptied before deletion.
- Locked Udhaar/Khata remains system-managed.

### Phase 3 — Entry and transfer — 2–3 days

```text
Money in:  amount · destination · date · category · source · note
Money out: amount · source · date · category · vendor · note
Transfer:  from box · to box · amount · date · note
```

Every balance change must create a timeline entry. Transfers use one paired ID so money cannot disappear.

### Phase 4 — Multi-touch cube control — implemented first slice

`HomeScreen` now keeps pointer-specific controls:

```dart
Map<int, _PointerControl> activePointers = {};
```

Expected behaviour:

- Finger 1 controls SBI.
- Finger 2 controls Cash.
- Finger 3 controls PhonePe.
- Finger 4 controls Savings.
- Each touched cube gets its own highlight.
- Releasing one finger does not release the other cubes.
- Physics/collision continues after release.
- Devices that do not support multi-touch fall back to one-finger mode.
- `Align` still returns all cubes to the tray layout.

This is the most technically important pending feature because the current `GestureDetector` flow only supports one active cube.

### Phase 5 — Sound and warnings — 2–3 days

Sound events:

- soft tap;
- cube bump;
- liquid pour on Aaya;
- drain on Kharch;
- transfer;
- Khata collection;
- warning;
- save success.

Settings:

```text
Pour sound       ON/OFF
Tap/bump sound   ON/OFF
Haptic feedback  ON/OFF
Multi-touch      ON/OFF
Reduce motion    ON/OFF
Voice entry      ON/OFF
```

Warnings:

- low balance;
- overdue Khata;
- old backup;
- missing UPI ID;
- duplicate entry;
- invalid import;
- transfer mismatch.

## Time estimate

### Working MVP

Includes menu, Add box, Edit box, archive/delete, detailed entry form and transfer:

**6–8 focused developer days**

### Full advanced cube version

Includes flexible boxes, safe data model, multi-touch, sound, warnings, preferences, migration and QA:

**12–16 focused developer days**

### Polished release

Includes responsive web tuning, animations, accessibility, Android testing, backup recovery tests and release assets:

**15–20 focused developer days**

For one person working part-time, this is approximately **3–4 calendar weeks**. The safest release strategy is to ship Phase 1–3 first, then enable multi-touch and sound behind settings.

## Definition of done

- User can keep 2, 5, 8 or configured-limit cubes.
- Add/edit/archive/delete works without data loss.
- Existing screenshot-style cube physics remains intact.
- Three or four fingers can control different cubes independently.
- Tap/drag/Find/Align still work after multi-touch is added.
- Every money change has a detail and undo path.
- Sound and haptics are optional.
- Khata and Locked Box remain consistent.
- PWA import and existing users remain safe.

## Direction lock

Do not implement the earlier vertical-account-bar concepts. The product direction is:

> **Playable translucent cubes in a physics tray, with money represented as liquid and every cube individually manageable.**
