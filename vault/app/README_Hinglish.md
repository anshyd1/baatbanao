# Ice-Cube Boxes — Flutter (Dart) me animated version

> ✅ **Compiled & verified:** Flutter 3.47.5 stable, `flutter build web --release` → 0 errors (60s compile). Ready bundle: `web_release/` (40 MB, CanvasKit included) — kisi bhi static host (Netlify / GitHub Pages / apna server) pe upload karke phone me kholo.

> **Demo video:** `cube_3d_views/anim/icecube_boxes_demo.mp4` (GIF bhi hai) — yehi sequence yeh code live chalata hai.

## 1. "Smooth language" kaunsi — aur kyu Flutter

| Option | Smoothness | Ek code → kahan chalega | Physics/gestures | HTML likhna? | Verdict |
|---|---|---|---|---|---|
| **Flutter (Dart)** | 60–120 fps, Impeller GPU renderer, apna canvas | Android + iOS + Web + Windows/Mac/Linux (laptop view free) | `Ticker`, `SpringSimulation`, `GestureDetector`, `HapticFeedback` built-in | **Nahi** | ✅ **Yeh lo** |
| React Native + Reanimated 3 + Skia | 60 fps (UI thread worklets) | Android + iOS (web weak) | Gesture Handler acha, collisions khud likhni | Nahi (JSX) | Agar JS hi rakhna hai to #2 |
| Kotlin Jetpack Compose | 120 fps native | Sirf Android | Bahut acha | Nahi | iOS/laptop chhod doge |
| Unity / Godot | Game-grade | Sab | Real physics engine | Nahi | Finance app ke liye overkill, APK 40MB+ |

Tumhara stack JS hai (BaatBanao PWA), lekin tumne bola *HTML nahi* aur *smooth* chahiye — Flutter me
**ek hi `CustomPainter` 8 cubes, paani ki lehar, glow, sab GPU pe draw karta hai**, widget tree har frame rebuild nahi hota. Isliye 8–12 cubes pe bhi 60 fps stable rehta hai, ₹8k ke Android pe bhi.

## 2. Setup (10 min)

```bash
# Flutter install: https://docs.flutter.dev/get-started/install  (Windows/Mac/Linux)
flutter doctor

flutter create paanikhata --org shop.baatbanao
cd paanikhata
# is folder ka lib/main.dart aur pubspec.yaml copy karke replace karo
flutter pub get

flutter run                 # phone/emulator (Android/iOS)
flutter run -d chrome       # LAPTOP view — same code, browser me (Flutter web = canvas, HTML nahi likha)
flutter run -d windows      # ya macos / linux — desktop app
flutter build apk --release # Play Store / direct share ke liye
```

Android pe Impeller (naya GPU renderer) on karo — `android/app/src/main/AndroidManifest.xml` ke `<application>` me:
```xml
<meta-data android:name="io.flutter.embedding.android.EnableImpeller" android:value="true" />
```

## 3. Code ka naksha (`lib/main.dart`, ~1100 lines, zero packages)

```
Account / Txn            -> model (n = box number FIXED, position badal sakti hai)
World (ChangeNotifier)   -> physics + state: bodies, slots, aligning, findN, txns, apply()
TrayPainter              -> EK CustomPaint = saare cubes (shadow, liquid wave, gloss, badge, text, glow, bump rings)
HomeScreen               -> Ticker (60/120fps loop) + gestures (pan = flick, long-press = drag, tap = detail)
FindBoxSheet             -> keypad + chips + mic placeholder  -> returns box number
AddMoneySheet            -> amount + box chips + category chips + note -> (box, amt, note)
DetailScreen             -> Frame 7 ek cube ke andar: ₹ scale, IN bands / OUT notches, timeline, "Is mahine"
```

**Smoothness ka raaz:** `World` har frame `notifyListeners()` karta hai → sirf `TrayPainter` repaint hota hai
(`CustomPainter(repaint: world)`), `setState` nahi. `RepaintBoundary` tray ko apni GPU layer deta hai.
Shadows `canvas.drawShadow` se (sasta), blur sirf 1 glow pe.

## 4. Video ↔ code mapping (jo demo me dikha, code me kahan hai)

| Demo me | Code me | Numbers |
|---|---|---|
| **Flick** — ungli se dhakka, cube slide + takkar | `_panStart/_panUpdate/_panEnd` → `World.step()` friction + walls + circle collisions | friction: 1s me velocity 35% (`pow(0.35, dt)`), wall bounce 0.55, cube-cube 0.5, flick cap 2500 px/s |
| **Bump ring + haptic tick** | `World._bump()` → `bumps` list + `HapticFeedback.lightImpact()` (80ms rate-limit) | ring 0.35s, radius 8→50px |
| **Spin** jab kona lage | `angV` from off-center push (`_grab × velocity`), collision tangential | clamp ±6 rad/s, damping `pow(0.2, dt)` |
| **Drag** (uthke rakho) | `_lpStart/_lpMove/_lpEnd` → `lifted=true` → scale 1.08 + shadow elevation 16, doosre cubes dhakka khate hain (kinematic collision) | long-press 500ms default |
| **Align** snap | `World.align()` → `aligning=true` → damped spring to `slots[i]` | k=72, c=12.6 → halka overshoot, ~0.75s me settle |
| **Find box #6** | `FindBoxSheet` → `world.setFind(6)` → dim overlay + pulsing glow + tooltip; 2.6s baad auto clear, tap se bhi clear | glow pulse `sin(t*6)`, dim 150/255 |
| **+Aaya ₹300 → liquid rise + pour stream** | `World.apply()` → `balance` update → `displayBal` exponential approach (count-up) + `pourUntil = time+1.3` → `_pour()` stream + ripples | rise ~1s, wave amp +5 during pour |
| **−Kharch** drain | same, `pourIn=false` → neeche red stream; **Cash negative → refuse + red snackbar** | |
| **Paani ki lehar** | `sin(2πx/95 + t*2.4 + n)`, amplitude 2.2 + speed, **tilt = −vx** (slide karte waqt paani peeche jhukta hai) | slope clamp ±0.28 |
| **Responsive** (7–8+ accounts) | `World.layout()` → 2 columns, rows = n/2, cube = min(150, fit) → 12 cubes bhi fit; rotate/resize pe auto re-align | Free 5 / Pro 12 (`World.maxFree/maxPro`) |

## 5. Laptop pe kya alag hoga
Same `main.dart` `flutter run -d chrome` / `-d windows` me chalega — mouse drag = pan (flick), mouse long-press = drag.
Laptop layout ke liye (sidebar + right "Recent" panel, jo mockup `responsive_views/05` me hai) `HomeScreen.build` me
`LayoutBuilder` lagao: `width >= 1024` → `Row([Sidebar, Expanded(tray), RecentPanel])`. Tray ka code same rehta hai.
Keyboard: `Shortcuts`/`Actions` widget se `A` = Aaya, `K` = Kharch, `1–9` = Find box.

## 5b. Web bundle host karna (phone pe test ke liye)
```bash
# web_release/ folder ko as-is upload karo (index.html root pe). Ya locally:
cd web_release && python3 -m http.server 8080
# phone same WiFi pe: http://<laptop-ip>:8080
```
Mobile browser me touch = pan/flick, long-press = drag. Haptics web pe nahi bajte (native app me bajenge).

## 6. Honest notes (kya abhi approximate hai)
- Collision **circle** approximation hai (`rad = 0.49 × cube`) — ghoome hue cube ke kone thoda overlap kar sakte hain. Real rigid-body chahiye to `flame_forge2d` (Box2D) — lekin pehle users se pucho, 90% ko farak nahi padega.
- `TextPainter` har frame 4×8 = 32 text layouts karta hai — 12 cubes tak theek; zyada ho to cache karo (`ui.Paragraph` reuse).
- Persistence **abhi memory me** hai — app band = data gaya. v0.2 me `hive_flutter`: `accounts` + `txns` box, `World` ko JSON se load/save (5 lines).
- Voice button placeholder hai — `speech_to_text` lagao, regex `box (\d+) me (\d+) (aaya|gaya)` parse karo.
- Physics **fun** hai, lekin core value nahi: agar 10 users me se 3 bolen "yeh hilta kyu hai", Align ko default-on karo (physics sirf long-press pe).

## 7. Agle 3 kaam (order me)
1. `hive` persistence + `feat/data-layer` branch (accounts/txns/settings schema jo research doc me hai)
2. Detail screen me txn tap → edit sheet + swipe delete + 5s Undo (Frame 7 spec)
3. 10 logon ko APK bhejo (WhatsApp) → dekho: kya woh Align dabate hain ya cubes se khelte hain? Kya "Find box" use hota hai ya seedha tap? Us data se decide karo physics rakhni hai ya nahi.

## 7. APK (Android) — bana hua hai ✅

- File: `PaaniKhata_IceCube_v0.1_arm64.apk` (18.9 MB, arm64-v8a, Android 7.0+ / minSdk 24)
- Package: `shop.baatbanao.paanikhata_icecubes`, version 0.1.0 (versionCode 2001)
- Signing: **debug key** (test build) — Play Store pe daalne se pehle apni keystore se sign karna hoga.
- Install: APK phone pe bhejo → tap → "Unknown sources / Is source se install allow karo" → Install.
  Play Protect warning aaye to "Install anyway".
- Data abhi in-memory hai (app band = reset). Persistence (hive) agla step hai.

### Khud build karna ho (laptop):
```
cd icecube_flutter
flutter pub get
flutter build apk --release --split-per-abi      # arm64 + armv7 + x86_64 teeno
# ya sirf 64-bit:  flutter build apk --release --target-platform android-arm64 --split-per-abi
```
`android/` folder isi repo me hai (low-RAM settings ke saath: daemon off, -Xmx560m, lint-vital off,
Kotlin ki jagah Java MainActivity). 8 GB+ RAM wale laptop pe `android/gradle.properties` me
`-Xmx560m` ko `-Xmx2g` kar do — build fast hoga.
