# BaatBanao Vault — Pending Work Master List

**Date:** 29 September 2026
**Current shipped build:** `v0.4.2+6` / Git tag `vault-v0.4.2`
**Next patch in progress:** `v0.4.3+7` — real sound service, visible cube actions, pinch zoom and release QA.
**Reference:** User-provided screenshot of the authentic cube-based Vault app.

This document separates what is already shipped from what is still incomplete. It is the working backlog for the next fixes and releases.

### Live QA snapshot — 29 September 2026

- `https://www.baatbanao.shop/app` is serving Vault `v0.4.2+6`.
- `/download` is serving the professional-English BaatBanao Vault landing page and direct APK choices.
- v0.4.2 addressed the web tray jank and made the home menu draggable/scrollable.
- v0.4.3 source now contains the real audio layer, pinch camera, visible per-cube action affordance and safer Khata delete flow; these still require CI/device QA before being called shipped.
- Still not complete after that patch: full device/update QA, stable production signing verification, and the final Khata ↔ Baat regression pass.
- SEO audience retention work now links the main SEO homepage directly to Vault and its download page; article-to-tool conversion and analytics must still be measured.

Do not mark the product complete until the acceptance checklist at the end passes on a real Android phone and the web app after a clean-cache reload.

---

## 0. Direction lock — must not be broken

These are product requirements, not optional suggestions.

- Keep the playable cube tray. Do not replace it with vertical bars, cards-only columns or a generic finance dashboard.
- Each money box remains a rounded, translucent, liquid-filled physics cube.
- Cubes must remain flickable, draggable, rotatable, bumpable and independently controllable.
- The supplied screenshot is the visual authority.
- Preserve the current Vault home language and hierarchy:
  - top total summary;
  - cube tray;
  - cube numbers and names;
  - `Align`;
  - `Find box`;
  - `+ Aaya`;
  - `− Kharch`;
  - `Vault · Khata · Baat` navigation.
- Existing users must keep balances, transaction history and the locked Khata/Udhaar box.
- Existing eight-box users must never be silently reset, renamed or migrated into a different layout.
- Box count must become user-controlled, including smaller setups such as 2–5 boxes, without breaking existing larger setups.
- Locked Khata must remain system-managed and safe.
- Sound is optional and must be switchable. Haptic feedback must remain configurable.
- Delete must be conservative: historical or non-zero boxes cannot be permanently deleted.

---

## 1. Already shipped through v0.4.2 — verify, polish and regression-test

These parts exist in the current code, but are not considered completely polished until device QA is complete.

- Add box.
- Edit box name, type, colour, goal and low-balance threshold.
- Optional opening balance and opening transaction.
- Stable box numbers.
- Archived active/archived collections.
- Archive and restore.
- Safe delete checks for locked, non-zero and historical boxes.
- Persistent archived boxes and account metadata.
- Per-box actions from Manage boxes and detail overflow.
- Add money and spend money from a selected box.
- Transfer between active boxes with paired transfer IDs.
- Date, category, source/person/vendor and note in money entry.
- Immediate undo for a newly-created money entry or transfer.
- First pointer-specific multi-touch implementation for independent cube control.
- Alerts screen for low-balance boxes.
- Preferences for sound, haptics, reduce motion and warning toggles.
- Latest-release update link in the home menu and Preferences.
- Local persistence and compatibility with older saves that do not contain archived boxes.
- `flutter analyze` clean.
- Existing Flutter tests passing.

---

## 2. User-reported issues from the first v0.4 install — P0 fixes

### P0.1 Make Delete visible and discoverable

**Reported:** Delete is hidden / not visible.

Required fix:

- Add a clearly visible `⋮` action button on every cube or a visible cube context affordance.
- The menu must expose:
  - Open details;
  - Add money;
  - Spend money;
  - Transfer;
  - Edit box;
  - Archive/restore;
  - Delete, only when safe.
- Show the disabled reason when Delete is blocked:
  - non-zero balance;
  - transaction history;
  - locked Khata.
- Do not make the user guess that Delete is inside a detail screen.
- Keep long-press drag available; do not overload long-press so it becomes unusable.

### P0.2 Add zoom and tray navigation

**Reported:** No zoom.

Required fix:

- Pinch-to-zoom inside the cube tray.
- Two-finger pan when zoomed.
- Keep one-finger cube flick/drag behaviour.
- Keep tap-to-open details.
- Keep `Align` able to return the tray to a useful fit-to-screen layout.
- Keep `Find box` able to focus a cube after zooming.
- Add zoom limits so cubes cannot disappear or become unusably large.
- Make the interaction work on small Android screens and web.
- Add reduced-motion behaviour for zoom and spring animations.

### P0.3 Build a real sound layer

**Reported:** No sound.

Current first slice only uses optional system click feedback. It is not the final audio feature.

Required fix:

- Add a central `SoundService` instead of scattered sound calls.
- Add switchable sounds for:
  - cube tap;
  - cube bump;
  - flick/release;
  - liquid pour on Aaya;
  - drain on Kharch;
  - transfer;
  - Khata collection;
  - warning;
  - save success;
  - undo.
- Sound must be off by default until verified on Android and web.
- Add master sound, effect volume and mute controls.
- Respect Android/browser restrictions and never play sound without a user gesture where the platform disallows it.
- Do not make sound a dependency for correct money behaviour.

### P0.4 Full device-install QA

- Test fresh install.
- Test update over v0.3.
- Test update over v0.4.
- Test APK download on Android Chrome.
- Test Android unknown-source permission flow.
- Test arm64 APK on a modern phone.
- Test armeabi-v7a APK on a 32-bit device/emulator.
- Test x86_64 APK on an emulator.
- Confirm the APK package ID is unchanged.
- Configure a stable release signing key for future updates; do not keep using a new CI debug key for production releases.
- Add a clear install/update troubleshooting screen.
- Test that local SharedPreferences data survives an update.
- Test that uninstall/reinstall is explicitly described as destructive for local data.

### P0.5 Make the update system honest

- Show current app version in Preferences.
- Show release date and release notes.
- Show `Check for update` state instead of only opening a link.
- Host a small version manifest with:
  - latest version;
  - minimum supported version;
  - release page;
  - arm64 APK URL;
  - armeabi-v7a APK URL;
  - web URL.
- Explain that Android still requires installation confirmation.
- Keep the latest-release fallback link if the manifest is unavailable.

---

## 3. Cube tray and interaction backlog

### P1.1 Finish multi-touch properly

- Three or four fingers must control three or four different cubes independently.
- Each pointer gets its own cube highlight.
- Releasing one pointer must not release another.
- Simultaneous cube collisions must remain stable.
- A second finger touching an already-controlled cube must not steal control.
- Pointer cancellation must restore physics state.
- Mouse/stylus/web pointer fallback must remain usable.
- Long-press reorder and normal flick must have a clear movement threshold.
- Add automated gesture tests where possible.

### P1.2 Pinch zoom and camera model

- Add tray camera scale and offset.
- Convert pointer coordinates between screen space and tray space.
- Prevent cubes from being dragged outside the camera world.
- Keep action buttons fixed outside the zoomed tray.
- Add a small reset/fit control if pinch zoom becomes hard to discover.

### P1.3 Persist reorder and layout intent

- Long-press drag should persist cube order or an explicit layout index.
- Align should use the persisted order.
- Adding, archiving and restoring must not randomly reorder existing boxes.
- Stable internal IDs should eventually replace using only box numbers as identity.
- Migrate old box-number data safely.

### P1.4 Improve cube readability

- Keep labels legible at all zoom levels.
- Add an unobtrusive low-balance indicator on the cube.
- Add a locked Khata visual that does not obscure the balance.
- Add optional type/icon badge.
- Add accessible semantic labels for each cube.
- Avoid putting too many controls over the liquid surface.

---

## 4. Box manager backlog

- Make the per-cube menu visible from the home tray.
- Add a dedicated reorder mode without breaking flick physics.
- Add box search by number and name.
- Add filters: active, archived, low balance, locked, type.
- Add an explicit active-box count limit with a future Pro setting, while allowing old users to keep existing boxes.
- Add duplicate-name warning, but do not force names to be unique.
- Add custom icons.
- Add UPI ID and account metadata where appropriate.
- Add optional colour accessibility checks.
- Add a safe “empty/transfer balance” workflow before archive.
- Add an archive reason and archived date.
- Add restore confirmation if the tray is crowded.
- Add an export-before-delete option.
- Add a visible data-safety explanation in the editor.

---

## 5. Money entry and transaction backlog

### P1.1 Entry form completeness

- Amount.
- Box.
- Money in / money out.
- Date and time.
- Category.
- Source, person or vendor.
- Note.
- Optional receipt/photo attachment.
- Optional recurring entry.
- Better numeric keypad and comma formatting.
- Clear validation for zero, negative, NaN and Infinity.
- Duplicate-entry warning.
- Save above the keyboard on small screens.

### P1.2 Transaction timeline

- Add a stable transaction ID.
- Show category/person/source metadata.
- Add per-entry overflow menu.
- Edit transaction safely.
- Reverse transaction with an explicit compensating entry.
- Delete only through a safe reversal flow.
- Show transfer pair links.
- Show opening-balance entries differently from ordinary income.
- Add date filters and monthly totals.
- Add search and category filters.
- Add undo after every applicable mutation, not only immediately after save.
- Keep historical usage flags after an entry is reversed.

### P1.3 Transfer completeness

- Source and destination boxes.
- Amount and date/time.
- Note/category.
- Paired transfer ID.
- Prevent same-box transfers.
- Prevent locked Khata transfers.
- Prevent insufficient source balance.
- Show both sides in both timelines.
- Reverse both sides together.
- Test interrupted save and reload scenarios.

---

## 6. Khata and BaatBanao integration backlog

These functions exist in the repository but need full integration and device QA with the new Vault flows.

### Khata

- Add udhaar entry.
- Edit entry.
- Delete entry safely.
- Partial collection.
- Full collection.
- Collection destination box selection.
- Locked Box balance stays exactly equal to pending outstanding Khata.
- Due dates and overdue state.
- Reminder count and last-reminded timestamp.
- Phone number validation.
- Contact/WhatsApp launch.
- Hindi, Hinglish, Bhojpuri and English fields.
- Friendly, Polite and Firm tone fields.
- Backup import and export.
- Empty/invalid import handling.
- Duplicate Khata ID handling.
- Offline persistence after every mutation.
- Overdue badge respects Preferences.

### Baat

- Select a pending person from Khata.
- Manual reminder composer.
- Amount and outstanding amount are correct.
- Language selector.
- Tone selector.
- Three message templates per language/tone.
- Copy message.
- Open WhatsApp.
- Fallback copy when WhatsApp is unavailable.
- UPI ID inclusion.
- Reminder count update only after copy/send succeeds as intended.
- Deep link from Khata to Baat.
- Test all 12 language/tone combinations.

### Vault ↔ Khata

- Collection creates destination income and locked-box reduction as paired, auditable changes.
- Locked Khata cannot be manually edited from Vault.
- Khata deletion/removal creates correct locked-box adjustment.
- Archive/delete menu never exposes unsafe Locked Box actions.
- Reload after every Khata/Vault combination keeps balances consistent.

---

## 7. Alerts and warnings backlog

- Low balance alerts per box.
- Overdue Khata alerts.
- Duplicate transaction warnings.
- Insufficient balance warning.
- Unsafe archive/delete explanation.
- Locked-box explanation.
- Old backup warning.
- Invalid import warning.
- Transfer mismatch warning.
- Missing UPI ID warning where a reminder needs it.
- Backup reminder.
- Permission explanation for notifications, sound and APK install.
- One central Alerts screen with read/unread state.
- Do not spam the user with repeated alerts.

---

## 8. Settings and sound backlog

- Sound master toggle.
- Sound volume.
- Tap/bump effects toggle.
- Pour/drain effects toggle.
- Haptic toggle.
- Reduce motion toggle.
- Multi-touch toggle/fallback.
- Voice entry toggle.
- Low-balance warning toggle.
- Overdue warning toggle.
- Language defaults.
- Tone defaults.
- UPI ID.
- Export data.
- Import data.
- Reset data with a typed confirmation.
- About/version/release notes.
- Link to privacy/help.

---

## 9. Accessibility and responsive UI backlog

- Screen-reader semantics for every cube and action.
- Text scaling without clipped cube labels.
- High-contrast mode or stronger label contrast.
- Minimum touch target sizes.
- Keyboard navigation on web.
- Visible focus rings on web.
- Avoid colour-only meaning for Aaya/Kharch/low balance.
- Small phone layout.
- Large phone layout.
- Landscape layout.
- Tablet layout.
- Web desktop layout.
- Reduced-motion mode verified on low-end devices.
- Hindi/Hinglish copy review and consistent terminology.

---

## 10. Data, migration and recovery backlog

- Add schema version migration tests for old Vault saves.
- Test saves without `archivedAccounts`.
- Test saves without `historicallyUsed`.
- Test saves with unknown transaction fields.
- Test corrupted JSON recovery.
- Test import/export round trip with archived boxes.
- Test 2, 5, 8 and 12 active boxes.
- Test archived historical boxes.
- Test stable box numbers after deletion and restore.
- Add stable UUID migration while retaining display numbers.
- Add backup timestamp and backup age.
- Add a recovery confirmation before reset.
- Never silently seed/reset accounts when a non-empty save exists.
- Keep existing Khata and Baat data during every Vault migration.

---

## 11. Release and engineering backlog

- Stable Android signing key stored in GitHub Secrets.
- Separate debug, staging and release builds.
- Version code/version name policy.
- Release notes generated per tag.
- APK architecture labels in the download UI.
- GitHub Actions build, analyze and test gates.
- Android install/update smoke test.
- Web build smoke test.
- PWA service-worker cache invalidation test.
- Offline launch test.
- Crash/error logging without collecting financial data.
- Performance test with 8, 12 and 20 cubes.
- Memory test after repeated add/archive/restore operations.
- Test sound/haptic permissions and browser restrictions.
- Test deep links and WhatsApp fallback.
- Publish a simple user-facing update guide.

---

## 12. Acceptance checklist before calling the next version complete

- [ ] Home still looks and behaves like the supplied cube screenshot.
- [ ] No vertical-bar redesign has entered the product.
- [ ] Delete is visible and explains why it is disabled.
- [ ] Pinch zoom works without breaking flick/drag/tap.
- [ ] Three or four fingers control separate cubes.
- [ ] Sound works when enabled and is silent when disabled.
- [ ] Haptics can be disabled.
- [ ] Add/edit/archive/restore/delete safety rules pass.
- [ ] Existing eight-box save reloads unchanged.
- [ ] Locked Khata remains derived from outstanding entries.
- [ ] Add money, spend, transfer and collection preserve paired history.
- [ ] Undo/reversal cannot create or hide money.
- [ ] Khata and Baat functions remain accessible from the bottom navigation.
- [ ] Update button opens a real, current release.
- [ ] APK can update without losing data or signing conflict.
- [ ] `flutter analyze` has no issues.
- [ ] `flutter test` passes.
- [ ] Android and web smoke tests pass.

---

## Recommended execution order

1. Fix visible delete/action affordance.
2. Add tray pinch zoom and camera coordinate conversion.
3. Add real sound service and test toggle.
4. Solve stable Android signing/update path.
5. Finish transaction IDs, timeline actions and reversals.
6. Harden multi-touch and reorder persistence.
7. Complete Khata ↔ Vault ↔ Baat regression testing.
8. Add accessibility/responsive pass.
9. Run release QA and publish the next APK/web release.
