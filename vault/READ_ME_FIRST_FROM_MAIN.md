# ⚠️ Read before your next commit — note from the `main` work-stream (28 Sep 2026, 23:15 IST)

If your last `git push` to `feat/vault` was rejected (non-fast-forward), this is why: `main` (v1.0.70) was merged into this
branch and this note was added. Run `git pull --rebase origin feat/vault` (or plain `git pull`) and continue —
**none of your files were modified.** Only additions: this note, one banner line at the top of `vault/README.md`,
and the files from `main`.

## Why you are being pinged
Two work-streams are active on this repo today: you on `feat/vault` (Flutter Vault) and another agent on `main`
(PWA + 16 SEO guide pages + AdSense readiness). No file overlap, 0 merge conflicts — but Vault depends on a few
contracts that already exist on `main`. Re-inventing them would break the PWA → Vault migration you planned.

## Do these 4 things
1. **Read [`/HANDOFF_VAULT.md`](../HANDOFF_VAULT.md)** (repo root, now in your tree). It has: every `bb_*` localStorage
   key + JSON shape (`bb_khata`, `bb_history`, `bb_settings`, `bb_invoices_v1`, `bb_hisaab_v1`, `bb_pro_*`), the backup
   file format `{"app":"BaatBanao","version":1,"exportedAt":…,"data":{…}}` your importer must accept, the `/pay?pa&pn&am&cu&tn`
   URL contract, the hash deep links (`/#vasooli`, `/#khata`, `/#billing`) all SEO pages point to, and the on-device QR rule.
2. **Acknowledge in Issue #2** → https://github.com/anshyd1/baatbanao/issues/2 (one line is enough; ask there if you need
   anything from `main` — the owner relays between agents).
3. **Fix the two P1s the Codex review bot left on PR #1** (https://github.com/anshyd1/baatbanao/pull/1):
   - `vault/app/android/.gitignore` ignores `gradlew` + `gradle-wrapper.jar`, and neither is tracked → CI/Gradle cannot bootstrap.
   - `vault/app/web/` (Flutter web scaffold, `web/index.html`) is missing → `flutter build web` fails; check what the
     `vault-v0.2` release actually contains. Run `flutter create --platforms=web .` inside `vault/app`.
   - P2s: reject `NaN`/`Infinity` amounts, persist slot reorder after drag, make the add-money sheet scroll with the keyboard.
4. **Keep PR #1's diff to `vault/**` + `.github/workflows/build-vault.yml`.** `main` already has `.vercelignore` that keeps
   `vault/` out of the `www.baatbanao.shop` static deploy, so merging is safe. Serve the Flutter web build at
   `app.baatbanao.shop` as your plan says — do not replace `/` on www (SEO + AdSense origin).

Brand assets you can reuse are listed in `HANDOFF_VAULT.md` §4 (palette, fonts, mascot WebPs, 16 featured illustrations).
