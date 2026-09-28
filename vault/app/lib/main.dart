// BaatBanao Vault — Ice-Cube Boxes (Flutter, single file, zero external packages)
// ---------------------------------------------------------------------------
// Har account = ek glass ice-cube box jisme liquid ka level = balance / goal.
// Interactions:
//   • Pan (ungli se dhakka/flick)  -> cube slide karta hai, doosre se takrata hai (physics + haptic)
//   • Long-press + drag            -> cube uth jaata hai (lifted), reorder ke liye
//   • Align button                 -> sab cubes spring ke saath apni grid slot me snap
//   • Find box                     -> keypad/chip se number chuno -> woh cube glow, baaki dim
//   • + Aaya / − Kharch            -> sheet se amount daalo -> liquid rise/drain + pour stream
//   • Tap cube                     -> Detail screen (scale, bands, timeline)
//
// Run:  flutter create paanikhata && cd paanikhata && (replace lib/main.dart) && flutter run
// Laptop: flutter run -d chrome   |   flutter run -d windows / macos / linux
// ---------------------------------------------------------------------------

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

void main() => runApp(const PaaniKhataApp());

class PaaniKhataApp extends StatelessWidget {
  const PaaniKhataApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BaatBanao Vault',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xFF3478F6),
        scaffoldBackgroundColor: const Color(0xFFF3F6FA),
      ),
      home: const HomeScreen(),
    );
  }
}

// =========================== MODEL ===========================

class Account {
  Account({required this.n, required this.name, required this.balance, required this.goal, required this.color});
  final int n; // box number: FIXED, kabhi nahi badalta (position badal sakti hai)
  String name;
  double balance;
  double goal; // scale ka top (auto-adjust: balance > goal ho to goal = balance)
  final Color color;
  double get pct => goal <= 0 ? 0 : (balance / goal).clamp(0.0, 1.0).toDouble();
}

class Txn {
  Txn(this.accN, this.amt, this.note, this.isIn, this.ts);
  final int accN;
  final double amt;
  final String note;
  final bool isIn; // true = aaya (green), false = gaya (red)
  final DateTime ts;
}

/// Indian format: 250000 -> ₹2,50,000
String inr(num v) {
  final neg = v < 0;
  final n = v.abs().round().toString();
  String out;
  if (n.length <= 3) {
    out = n;
  } else {
    final last3 = n.substring(n.length - 3);
    var rest = n.substring(0, n.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    out = '${parts.join(',')},$last3';
  }
  return '${neg ? '-' : ''}₹$out';
}

List<Account> seedAccounts() => [
      Account(n: 1, name: 'SBI', balance: 200, goal: 2000, color: const Color(0xFF3478F6)),
      Account(n: 2, name: 'HDFC', balance: 2000, goal: 2000, color: const Color(0xFF20B296)),
      Account(n: 3, name: 'Cash', balance: 1600, goal: 2000, color: const Color(0xFFFF8C28)),
      Account(n: 4, name: 'PhonePe', balance: 450, goal: 2000, color: const Color(0xFF7846C8)),
      Account(n: 5, name: 'Paytm', balance: 900, goal: 2000, color: const Color(0xFF3CAAF0)),
      Account(n: 6, name: 'ICICI', balance: 1200, goal: 2000, color: const Color(0xFF4650BE)),
      Account(n: 7, name: 'Gold', balance: 2500, goal: 2500, color: const Color(0xFFDCAA28)),
      Account(n: 8, name: 'Udhaar', balance: 300, goal: 2000, color: const Color(0xFF828C96)),
    ];

List<Txn> seedTxns() {
  final now = DateTime.now();
  return [
    Txn(3, 500, 'Salary', true, now.subtract(const Duration(days: 1))),
    Txn(3, 300, 'Kirana', false, now.subtract(const Duration(days: 2))),
    Txn(3, 800, 'Udhaar wapas', true, now.subtract(const Duration(days: 3))),
    Txn(3, 200, 'Chai', false, now.subtract(const Duration(days: 4))),
    Txn(3, 300, 'Shop sale', true, now.subtract(const Duration(days: 6))),
    Txn(2, 2000, 'Salary', true, now.subtract(const Duration(days: 5))),
  ];
}

// =========================== PHYSICS WORLD ===========================

class CubeBody {
  CubeBody(this.acc);
  final Account acc;
  Offset pos = Offset.zero; // tray-local center
  Offset vel = Offset.zero; // px / s
  double ang = 0; // radians
  double angV = 0; // rad / s
  bool lifted = false; // long-press drag
  bool kinematic = false; // ungli control me hai -> physics isko move nahi karti
  double displayBal = 0; // animated balance (count-up + liquid rise)
  double pourUntil = -1; // world.time tak pour/drain stream dikhao
  bool pourIn = true;
}

class Bump {
  Bump(this.p, this.t0, this.s);
  final Offset p;
  final double t0;
  final double s; // strength px/s
}

/// Saari physics + UI state yahan. ChangeNotifier => CustomPainter `repaint` ke through
/// sirf tray repaint hoti hai, poora widget tree rebuild NAHI hota (smoothness ka raaz).
class World extends ChangeNotifier {
  World(List<Account> accounts, this.txns) {
    for (final a in accounts) {
      bodies.add(CubeBody(a)..displayBal = a.balance);
    }
  }
  static const int maxFree = 5, maxPro = 12;

  final List<CubeBody> bodies = [];
  final List<Txn> txns;
  final List<Bump> bumps = [];

  Size tray = Size.zero;
  double cube = 150; // cube size (responsive)
  List<Offset> slots = [];
  bool _placed = false;

  bool aligning = false;
  int? findN;
  double findT = 0; // 0..1 dim/glow progress
  double time = 0;
  double _lastHaptic = -1;

  double get total => bodies.fold(0.0, (s, b) => s + b.acc.balance);

  CubeBody byN(int n) => bodies.firstWhere((b) => b.acc.n == n);

  /// Tray ka size mila -> cube size + grid slots compute karo (2 columns, rows = n/2)
  void layout(Size size) {
    if (size == tray && _placed) return;
    tray = size;
    final n = bodies.length;
    const cols = 2;
    final rows = (n / cols).ceil();
    const gap = 18.0;
    cube = math.min(150.0, math.min((size.width - gap * (cols + 1)) / cols, (size.height - gap * (rows + 1)) / rows));
    slots = List.generate(n, (i) {
      final c = i % cols, r = i ~/ cols;
      return Offset(size.width * (c == 0 ? 0.28 : 0.72), (r + 0.5) * (size.height / rows));
    });
    if (!_placed) {
      for (var i = 0; i < n; i++) {
        bodies[i].pos = slots[i];
      }
      _placed = true;
    } else {
      aligning = true; // rotate / resize hua -> wapas grid me
    }
  }

  void align() {
    aligning = true;
    HapticFeedback.lightImpact();
  }

  void _bump(Offset p, double strength) {
    bumps.add(Bump(p, time, strength));
    if (time - _lastHaptic > 0.08) {
      _lastHaptic = time;
      HapticFeedback.lightImpact(); // "haptic tick" har takkar pe (rate-limited)
    }
  }

  /// Ek physics step. dt seconds me (Ticker se, 60/120 fps)
  void step(double dt) {
    time += dt;
    final hs = cube / 2, rad = cube * 0.49;

    if (aligning) {
      // Damped spring -> grid slot. k=72, c=12.6 => halka overshoot (underdamped), ~0.75s
      var settled = true;
      for (var i = 0; i < bodies.length; i++) {
        final b = bodies[i];
        if (b.kinematic) continue;
        final target = slots[i];
        b.vel += (target - b.pos) * 72 * dt - b.vel * 12.6 * dt;
        b.pos += b.vel * dt;
        b.angV += (0 - b.ang) * 72 * dt - b.angV * 12.6 * dt;
        b.ang += b.angV * dt;
        if ((target - b.pos).distance > 0.5 || b.vel.distance > 2) settled = false;
      }
      if (settled) {
        aligning = false;
        for (final b in bodies) {
          b.vel = Offset.zero;
          b.angV = 0;
          b.ang = 0;
        }
      }
    } else {
      final f = math.pow(0.35, dt).toDouble(); // friction: 1 sec me velocity 35% reh jaati hai
      final fa = math.pow(0.2, dt).toDouble();
      for (final b in bodies) {
        if (b.kinematic) continue;
        b.pos += b.vel * dt;
        b.ang += b.angV * dt;
        b.vel *= f;
        b.angV *= fa;
        if (b.vel.distance < 1) b.vel = Offset.zero;
        // tray walls (restitution 0.55)
        var x = b.pos.dx, y = b.pos.dy, vx = b.vel.dx, vy = b.vel.dy;
        const e = 0.55;
        if (x - hs < 6) {
          x = 6 + hs;
          if (vx < -60) _bump(Offset(x - hs, y), -vx);
          vx = -vx * e;
          b.angV += -vy * 0.0003;
        }
        if (x + hs > tray.width - 6) {
          x = tray.width - 6 - hs;
          if (vx > 60) _bump(Offset(x + hs, y), vx);
          vx = -vx * e;
          b.angV += vy * 0.0003;
        }
        if (y - hs < 6) {
          y = 6 + hs;
          if (vy < -60) _bump(Offset(x, y - hs), -vy);
          vy = -vy * e;
          b.angV += vx * 0.0003;
        }
        if (y + hs > tray.height - 6) {
          y = tray.height - 6 - hs;
          if (vy > 60) _bump(Offset(x, y + hs), vy);
          vy = -vy * e;
          b.angV += -vx * 0.0003;
        }
        b.pos = Offset(x, y);
        b.vel = Offset(vx, vy);
      }
      // cube-cube collisions (circle approximation, 2 passes for stability)
      for (var pass = 0; pass < 2; pass++) {
        for (var i = 0; i < bodies.length; i++) {
          for (var j = i + 1; j < bodies.length; j++) {
            final a = bodies[i], b = bodies[j];
            final d = b.pos - a.pos;
            final dist = d.distance;
            if (dist == 0 || dist >= 2 * rad) continue;
            final nrm = d / dist;
            final ov = 2 * rad - dist;
            if (a.kinematic) {
              b.pos += nrm * ov;
            } else if (b.kinematic) {
              a.pos -= nrm * ov;
            } else {
              a.pos -= nrm * (ov / 2);
              b.pos += nrm * (ov / 2);
            }
            final rv = b.vel - a.vel;
            final rvn = rv.dx * nrm.dx + rv.dy * nrm.dy;
            if (rvn < 0) {
              const e = 0.5;
              if (a.kinematic) {
                b.vel += nrm * (-(1 + e) * rvn);
              } else if (b.kinematic) {
                a.vel -= nrm * (-(1 + e) * rvn);
              } else {
                final jn = -(1 + e) * rvn / 2;
                a.vel -= nrm * jn;
                b.vel += nrm * jn;
              }
              final tang = rv.dx * (-nrm.dy) + rv.dy * nrm.dx;
              a.angV += tang * 0.0005;
              b.angV -= tang * 0.0005;
              if (-rvn > 60) _bump(a.pos + nrm * rad, -rvn);
            }
          }
        }
      }
    }

    // liquid level + amount count-up: exponential approach (smooth, no jank)
    for (final b in bodies) {
      final diff = b.acc.balance - b.displayBal;
      b.displayBal += diff * math.min(1.0, 3 * dt);
      if (diff.abs() < 0.5) b.displayBal = b.acc.balance;
    }
    bumps.removeWhere((x) => time - x.t0 > 0.35);
    findT = findN != null ? math.min(1.0, findT + dt * 3) : math.max(0.0, findT - dt * 3);
    notifyListeners();
  }

  /// +Aaya / −Kharch apply. Cash negative nahi ja sakta -> false return (warn).
  bool apply(int n, double amt, bool isIn, String note) {
    final b = byN(n);
    if (!isIn && b.acc.name == 'Cash' && b.acc.balance - amt < 0) return false;
    b.acc.balance += isIn ? amt : -amt;
    if (b.acc.balance > b.acc.goal) b.acc.goal = b.acc.balance; // scale auto-adjust
    txns.insert(0, Txn(n, amt, note, isIn, DateTime.now()));
    b.pourUntil = time + 1.3;
    b.pourIn = isIn;
    HapticFeedback.mediumImpact();
    return true;
  }

  void setFind(int? n) {
    findN = n;
    notifyListeners();
  }
}

// =========================== TRAY PAINTER ===========================
// Ek hi CustomPaint me saare cubes: shadow, liquid wave, gloss, badge, text, glow, bumps.

class TrayPainter extends CustomPainter {
  TrayPainter(this.w) : super(repaint: w);
  final World w;

  @override
  void paint(Canvas canvas, Size size) {
    final found = w.findN == null ? null : w.byN(w.findN!);
    final lifted = w.bodies.where((b) => b.lifted).toList();

    for (final b in w.bodies) {
      if (b.lifted || identical(b, found)) continue;
      _cube(canvas, b, 1.0);
    }
    if (found != null && w.findT > 0) {
      // dim everything else
      canvas.drawRRect(
        RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(26)),
        Paint()..color = const Color(0xFF141E32).withAlpha((150 * w.findT).round()),
      );
      // pulsing glow
      final s = w.cube * 1.06;
      final pulse = 0.55 + 0.45 * math.sin(w.time * 6);
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromCenter(center: found.pos, width: s + 20, height: s + 20), Radius.circular(s * 0.24)),
        Paint()
          ..color = const Color(0xFF46DCFF).withAlpha((230 * pulse * w.findT).round())
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 22),
      );
      _cube(canvas, found, 1.06);
      _tooltip(canvas, found);
    } else if (found != null) {
      _cube(canvas, found, 1.0);
    }
    for (final b in lifted) {
      _cube(canvas, b, 1.08);
    }
    for (final b in w.bodies) {
      _pour(canvas, b);
    }
    // bump rings (haptic ka visual)
    for (final bp in w.bumps) {
      final age = (w.time - bp.t0) / 0.35;
      final rr = 8 + 42 * age * math.min(1.5, 0.5 + bp.s / 600);
      canvas.drawCircle(
        bp.p,
        rr,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..color = const Color(0xFFFF6E46).withAlpha((200 * (1 - age)).round().clamp(0, 255).toInt()),
      );
    }
  }

  void _cube(Canvas canvas, CubeBody b, double scale) {
    final s = w.cube * scale, hs = s / 2;
    final col = b.acc.color;
    final rect = Rect.fromCenter(center: Offset.zero, width: s, height: s);
    final rr = RRect.fromRectAndRadius(rect, Radius.circular(s * 0.19));

    canvas.save();
    canvas.translate(b.pos.dx, b.pos.dy);
    canvas.rotate(b.ang);

    // shadow (cheap, GPU friendly)
    canvas.drawShadow(Path()..addRRect(rr.shift(const Offset(0, 6))), const Color(0xFF14284F), b.lifted ? 16 : 6, false);

    // base tint
    canvas.drawRRect(rr, Paint()..color = Color.lerp(Colors.white, col, 0.13)!);

    // liquid (clipped)
    canvas.save();
    canvas.clipRRect(rr);
    final pct = b.acc.goal <= 0 ? 0.0 : (b.displayBal / b.acc.goal).clamp(0.0, 1.0).toDouble();
    final level = -hs + 4 + (1 - pct) * (s - 8);
    final slope = (-b.vel.dx * 0.0005).clamp(-0.28, 0.28).toDouble();
    final pouring = w.time < b.pourUntil;
    final pourAmp = pouring ? 5 * math.sin(math.pi * (1 - (b.pourUntil - w.time) / 1.3)) : 0.0;
    final amp = 2.2 + math.min(6.0, b.vel.distance * 0.02) + pourAmp;
    final surf = Path();
    final fill = Path()..moveTo(-hs - 2, hs + 6);
    for (double x = -hs - 2; x <= hs + 2; x += 5) {
      final y = level + slope * x + amp * math.sin(2 * math.pi * (x + hs) / 95 + w.time * 2.4 + b.acc.n);
      fill.lineTo(x, y);
      if (x == -hs - 2) {
        surf.moveTo(x, y);
      } else {
        surf.lineTo(x, y);
      }
    }
    fill
      ..lineTo(hs + 2, hs + 6)
      ..close();
    canvas.drawPath(fill, Paint()..color = col.withAlpha(210));
    canvas.drawPath(
      surf,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = Colors.white.withAlpha(170),
    );
    // gloss
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(-hs + 12, -hs + 9, s * 0.5, 21), const Radius.circular(12)), Paint()..color = Colors.white.withAlpha(95));
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(hs - 22, -hs + 24, 9, s - 68), const Radius.circular(5)), Paint()..color = Colors.white.withAlpha(70));
    canvas.restore();

    // borders
    canvas.drawRRect(
      rr,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = Color.lerp(col, Colors.black, 0.28)!.withAlpha(170),
    );
    canvas.drawRRect(
      rr.deflate(2),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = Colors.white.withAlpha(140),
    );

    // label pill + texts (readable on any liquid colour)
    final k = s / 150; // font scale
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(0, 5 * k), width: 124 * k, height: 62 * k), Radius.circular(14 * k)), Paint()..color = Colors.white.withAlpha(175));
    canvas.drawCircle(Offset(-hs + 22 * k, -hs + 22 * k), 14 * k, Paint()..color = Colors.white.withAlpha(240));
    canvas.drawCircle(
      Offset(-hs + 22 * k, -hs + 22 * k),
      14 * k,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = const Color(0xFF505050),
    );
    _text(canvas, '${b.acc.n}', Offset(-hs + 22 * k, -hs + 22 * k), 15 * k);
    _text(canvas, '${(pct * 100).round()}%', Offset(hs - 12 * k, -hs + 22 * k), 15 * k, anchor: Alignment.centerRight, color: const Color(0xFF323232));
    _text(canvas, b.acc.name, Offset(0, -8 * k), 19 * k);
    _text(canvas, inr(b.displayBal), Offset(0, 18 * k), 19 * k);
    canvas.restore();
  }

  void _pour(Canvas canvas, CubeBody b) {
    if (w.time >= b.pourUntil) return;
    final s = w.cube, hs = s / 2;
    final prog = 1 - (b.pourUntil - w.time) / 1.3;
    final a = (230 * math.sin(math.pi * prog)).round().clamp(0, 255).toInt();
    final pct = (b.displayBal / b.acc.goal).clamp(0.0, 1.0).toDouble();
    final surfY = b.pos.dy - hs + 4 + (1 - pct) * (s - 8);
    final paint = Paint()..color = (b.pourIn ? b.acc.color : const Color(0xFFE14646)).withAlpha(a);
    if (b.pourIn) {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTRB(b.pos.dx - 5, b.pos.dy - hs - 40, b.pos.dx + 5, surfY + 4), const Radius.circular(5)), paint);
    } else {
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTRB(b.pos.dx - 5, b.pos.dy + hs - 4, b.pos.dx + 5, b.pos.dy + hs + 40 * prog), const Radius.circular(5)), paint);
    }
    for (var k = 0; k < 3; k++) {
      final rr = 8 + 10 * k + 6 * math.sin(w.time * 9 + k);
      canvas.drawOval(
        Rect.fromCenter(center: Offset(b.pos.dx, surfY), width: rr * 2, height: rr / 1.5),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = Colors.white.withAlpha((a * 0.6).round()),
      );
    }
  }

  void _tooltip(Canvas canvas, CubeBody b) {
    final t = w.findT;
    final c = Offset(b.pos.dx, b.pos.dy - w.cube * 0.5 - 44);
    final r = RRect.fromRectAndRadius(Rect.fromCenter(center: c, width: 214, height: 44), const Radius.circular(14));
    canvas.drawRRect(r, Paint()..color = Colors.white.withAlpha((240 * t).round()));
    canvas.drawPath(
      Path()
        ..moveTo(c.dx - 10, c.dy + 22)
        ..lineTo(c.dx + 10, c.dy + 22)
        ..lineTo(c.dx, c.dy + 34)
        ..close(),
      Paint()..color = Colors.white.withAlpha((240 * t).round()),
    );
    _text(canvas, '${b.acc.n} · ${b.acc.name}  ${inr(b.acc.balance)} · ${(b.acc.pct * 100).round()}%', c, 16, color: const Color(0xFF14181E).withAlpha((255 * t).round()));
  }

  void _text(Canvas canvas, String s, Offset at, double size, {Alignment anchor = Alignment.center, Color color = const Color(0xFF141414)}) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: TextStyle(fontSize: size, fontWeight: FontWeight.w700, color: color)),
      textDirection: TextDirection.ltr,
    )..layout();
    final dx = anchor == Alignment.centerRight ? at.dx - tp.width : (anchor == Alignment.centerLeft ? at.dx : at.dx - tp.width / 2);
    tp.paint(canvas, Offset(dx, at.dy - tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant TrayPainter old) => false; // repaint Listenable (World) handle karta hai
}

// =========================== HOME SCREEN ===========================

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late final World world;
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  CubeBody? _active;
  Offset _grab = Offset.zero;
  Offset _lastLocal = Offset.zero;

  @override
  void initState() {
    super.initState();
    world = World(seedAccounts(), seedTxns());
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration elapsed) {
    var dt = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    if (dt <= 0 || dt > 0.05) dt = 1 / 60; // frame drop / first frame guard
    world.step(dt);
  }

  @override
  void dispose() {
    _ticker.dispose();
    world.dispose();
    super.dispose();
  }

  // ---------- gestures ----------
  CubeBody? _hit(Offset p) {
    final hs = world.cube / 2;
    for (final b in world.bodies.reversed) {
      final d = p - b.pos;
      if (d.dx.abs() <= hs && d.dy.abs() <= hs) return b;
    }
    return null;
  }

  Offset _clampInTray(Offset p) {
    final hs = world.cube / 2;
    return Offset(p.dx.clamp(6 + hs, world.tray.width - 6 - hs).toDouble(), p.dy.clamp(6 + hs, world.tray.height - 6 - hs).toDouble());
  }

  // FLICK / PUSH: pan -> cube ungli ke saath, release pe velocity milti hai
  void _panStart(DragStartDetails d) {
    if (world.findN != null) world.setFind(null);
    _active = _hit(d.localPosition);
    if (_active == null) return;
    _active!.kinematic = true;
    _grab = d.localPosition - _active!.pos;
    _lastLocal = d.localPosition;
    HapticFeedback.selectionClick();
  }

  void _panUpdate(DragUpdateDetails d) {
    final b = _active;
    if (b == null) return;
    b.pos = _clampInTray(d.localPosition - _grab);
    b.vel = d.delta * 60; // px/s, taaki takkar me doosre cubes ko dhakka lage
    _lastLocal = d.localPosition;
  }

  void _panEnd(DragEndDetails d) {
    final b = _active;
    if (b == null) return;
    var v = d.velocity.pixelsPerSecond;
    if (v.distance > 2500) v = v / v.distance * 2500; // cap
    b.vel = v;
    b.angV = ((_grab.dx * v.dy - _grab.dy * v.dx) * 0.00005).clamp(-6.0, 6.0).toDouble(); // off-center push => spin
    b.kinematic = false;
    _active = null;
  }

  // DRAG (reorder): long-press -> lift -> move -> drop
  void _lpStart(LongPressStartDetails d) {
    _active = _hit(d.localPosition);
    if (_active == null) return;
    _active!
      ..kinematic = true
      ..lifted = true;
    _grab = d.localPosition - _active!.pos;
    _lastLocal = d.localPosition;
    HapticFeedback.mediumImpact();
  }

  void _lpMove(LongPressMoveUpdateDetails d) {
    final b = _active;
    if (b == null) return;
    final delta = d.localPosition - _lastLocal;
    _lastLocal = d.localPosition;
    b.pos = _clampInTray(d.localPosition - _grab);
    b.vel = delta * 60;
    b.ang = (-delta.dx * 0.02).clamp(-0.14, 0.14).toDouble(); // halka tilt while carrying
  }

  void _lpEnd(LongPressEndDetails d) {
    final b = _active;
    if (b == null) return;
    b
      ..lifted = false
      ..kinematic = false
      ..vel = d.velocity.pixelsPerSecond * 0.3;
    _active = null;
    HapticFeedback.lightImpact();
  }

  void _tapUp(TapUpDetails d) {
    if (world.findN != null) {
      world.setFind(null);
      return;
    }
    final b = _hit(d.localPosition);
    if (b == null) return;
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(acc: b.acc, txns: world.txns)));
  }

  // ---------- sheets ----------
  Future<void> _findBox() async {
    final n = await showModalBottomSheet<int>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
      builder: (_) => FindBoxSheet(accounts: world.bodies.map((b) => b.acc).toList()),
    );
    if (n == null) return;
    world.setFind(n);
    Future.delayed(const Duration(milliseconds: 2600), () {
      if (world.findN == n) world.setFind(null);
    });
  }

  Future<void> _addMoney(bool isIn, {int? preselect}) async {
    final res = await showModalBottomSheet<(int, double, String)>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
      builder: (_) => AddMoneySheet(isIn: isIn, accounts: world.bodies.map((b) => b.acc).toList(), preselect: preselect),
    );
    if (res == null || !mounted) return;
    final ok = world.apply(res.$1, res.$2, isIn, res.$3);
    final msg = ok
        ? 'Box ${res.$1} · ${world.byN(res.$1).acc.name}   ${isIn ? '+' : '−'}${inr(res.$2)}'
        : 'Cash negative nahi ho sakta — pehle Cash me paisa add karo';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg, style: TextStyle(color: ok ? const Color(0xFF78E696) : Colors.white, fontWeight: FontWeight.w700)),
      backgroundColor: ok ? const Color(0xFF1E242E) : const Color(0xFFE14646),
      behavior: SnackBarBehavior.floating,
      duration: const Duration(milliseconds: 1800),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 10),
            AnimatedBuilder(
              animation: world,
              builder: (_, __) => Text('Total ${inr(world.total)} · ${world.bodies.length} boxes',
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF14181E))),
            ),
            const Padding(
              padding: EdgeInsets.only(top: 4, bottom: 10),
              child: Text('flick · long-press drag · Align · Find box · tap = detail', style: TextStyle(fontSize: 13, color: Color(0xFF5A6473))),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6EAF0),
                    borderRadius: BorderRadius.circular(26),
                    border: Border.all(color: const Color(0xFFD6DCE4), width: 4),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: LayoutBuilder(
                    builder: (context, c) {
                      world.layout(Size(c.maxWidth, c.maxHeight));
                      return GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTapUp: _tapUp,
                        onPanStart: _panStart,
                        onPanUpdate: _panUpdate,
                        onPanEnd: _panEnd,
                        onLongPressStart: _lpStart,
                        onLongPressMoveUpdate: _lpMove,
                        onLongPressEnd: _lpEnd,
                        child: RepaintBoundary(
                          child: SizedBox.expand(child: CustomPaint(painter: TrayPainter(world))),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _Chip(icon: Icons.grid_view_rounded, label: 'Align', onTap: world.align),
                const SizedBox(width: 14),
                _Chip(icon: Icons.tag_rounded, label: 'Find box', onTap: _findBox),
              ],
            ),
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: Row(
                children: [
                  Expanded(child: _BigButton(label: '+  Aaya', color: const Color(0xFF2EA05A), onTap: () => _addMoney(true))),
                  const SizedBox(width: 16),
                  Expanded(child: _BigButton(label: '−  Kharch', color: const Color(0xFFE14646), onTap: () => _addMoney(false))),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: StadiumBorder(side: BorderSide(color: const Color(0xFFC8CED8), width: 2)),
      child: InkWell(
        customBorder: const StadiumBorder(),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 20, color: const Color(0xFF283C64)),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF1E242E))),
          ]),
        ),
      ),
    );
  }
}

class _BigButton extends StatelessWidget {
  const _BigButton({required this.label, required this.color, required this.onTap});
  final String label;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 62,
      child: FilledButton(
        style: FilledButton.styleFrom(backgroundColor: color, shape: const StadiumBorder(), textStyle: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800)),
        onPressed: onTap,
        child: Text(label),
      ),
    );
  }
}

// =========================== FIND BOX SHEET ===========================

class FindBoxSheet extends StatefulWidget {
  const FindBoxSheet({super.key, required this.accounts});
  final List<Account> accounts;
  @override
  State<FindBoxSheet> createState() => _FindBoxSheetState();
}

class _FindBoxSheetState extends State<FindBoxSheet> {
  String typed = '';

  void _press(String k) {
    HapticFeedback.selectionClick();
    setState(() {
      if (k == '⌫') {
        typed = typed.isEmpty ? '' : typed.substring(0, typed.length - 1);
      } else if (typed.length < 2) {
        typed += k;
      }
    });
    final n = int.tryParse(typed);
    if (n != null && widget.accounts.any((a) => a.n == n)) {
      // agar 1 digit se hi unique match hai to seedha jump (10+ boxes ho to 2nd digit ka wait)
      final moreDigitsPossible = widget.accounts.any((a) => a.n >= n * 10 && a.n < n * 10 + 10);
      if (!moreDigitsPossible || typed.length == 2) {
        Future.delayed(const Duration(milliseconds: 220), () {
          if (mounted) Navigator.of(context).pop(n);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const teal = Color(0xFF148CAA);
    final selected = int.tryParse(typed);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 48, height: 5, decoration: BoxDecoration(color: const Color(0xFFC8CDD4), borderRadius: BorderRadius.circular(3))),
        const SizedBox(height: 14),
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: const Color(0xFFF6F8FB), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFCDD4DE), width: 2)),
          child: Row(children: [
            Expanded(
              child: Text(typed.isEmpty ? 'Box number bolo ya type karo' : typed,
                  style: TextStyle(fontSize: typed.isEmpty ? 16 : 26, fontWeight: FontWeight.w700, color: typed.isEmpty ? const Color(0xFF969EAA) : teal)),
            ),
            IconButton(
              icon: const Icon(Icons.mic_rounded, color: teal),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Voice: speech_to_text package lagao → "box 6" parse karo'))),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final a in widget.accounts)
              ChoiceChip(
                label: Text('${a.n} ${a.name}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                selected: selected == a.n,
                selectedColor: const Color(0xFF192846),
                labelStyle: TextStyle(color: selected == a.n ? Colors.white : const Color(0xFF282E38)),
                showCheckmark: false,
                onSelected: (_) => Navigator.of(context).pop(a.n),
              ),
          ],
        ),
        const SizedBox(height: 12),
        for (final row in const [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '⌫']])
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              for (final k in row)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: k.isEmpty
                        ? const SizedBox(height: 50)
                        : OutlinedButton(
                            style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(50), shape: const StadiumBorder(), side: const BorderSide(color: Color(0xFFD7DCE4), width: 2), foregroundColor: const Color(0xFF1E222A)),
                            onPressed: () => _press(k),
                            child: Text(k, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                          ),
                  ),
                ),
            ]),
          ),
      ]),
    );
  }
}

// =========================== ADD MONEY SHEET ===========================

class AddMoneySheet extends StatefulWidget {
  const AddMoneySheet({super.key, required this.isIn, required this.accounts, this.preselect});
  final bool isIn;
  final List<Account> accounts;
  final int? preselect;
  @override
  State<AddMoneySheet> createState() => _AddMoneySheetState();
}

class _AddMoneySheetState extends State<AddMoneySheet> {
  late int box = widget.preselect ?? widget.accounts.first.n;
  final amt = TextEditingController();
  final note = TextEditingController();
  static const cats = ['Khana', 'Ghar', 'Safar', 'Udhaar', 'Salary', 'Aur'];

  @override
  Widget build(BuildContext context) {
    final color = widget.isIn ? const Color(0xFF2EA05A) : const Color(0xFFE14646);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(widget.isIn ? '+ Aaya' : '− Kharch', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 12),
        TextField(
          controller: amt,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800),
          decoration: const InputDecoration(prefixText: '₹ ', hintText: '0', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
        ),
        const SizedBox(height: 12),
        const Text('Kaunsa box?', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF5A6473))),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final a in widget.accounts)
              ChoiceChip(
                label: Text('${a.n} ${a.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
                selected: box == a.n,
                selectedColor: a.color,
                labelStyle: TextStyle(color: box == a.n ? Colors.white : const Color(0xFF282E38)),
                showCheckmark: false,
                onSelected: (_) => setState(() => box = a.n),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          children: [for (final c in cats) ActionChip(label: Text(c), onPressed: () => setState(() => note.text = c))],
        ),
        const SizedBox(height: 8),
        TextField(controller: note, decoration: const InputDecoration(hintText: 'Note (Kirana, Salary…)', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))))),
        const SizedBox(height: 14),
        SizedBox(
          height: 56,
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: color, shape: const StadiumBorder(), textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            onPressed: () {
              final v = double.tryParse(amt.text.trim());
              if (v == null || v <= 0) return;
              Navigator.of(context).pop((box, v, note.text.trim().isEmpty ? (widget.isIn ? 'Aaya' : 'Kharch') : note.text.trim()));
            },
            child: const Text('Save'),
          ),
        ),
      ]),
    );
  }
}

// =========================== DETAIL SCREEN (Frame 7 inside a cube) ===========================

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.acc, required this.txns});
  final Account acc;
  final List<Txn> txns;
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  int view = 0; // 0 IN, 1 OUT, 2 ALL

  @override
  Widget build(BuildContext context) {
    final mine = widget.txns.where((t) => t.accN == widget.acc.n).toList();
    final shown = mine.where((t) => view == 2 || (view == 0 ? t.isIn : !t.isIn)).toList();
    final aaya = mine.where((t) => t.isIn).fold(0.0, (s, t) => s + t.amt);
    final gaya = mine.where((t) => !t.isIn).fold(0.0, (s, t) => s + t.amt);
    return Scaffold(
      appBar: AppBar(
        title: Text('Box ${widget.acc.n} · ${widget.acc.name} ${inr(widget.acc.balance)}'),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        actions: [IconButton(icon: const Icon(Icons.more_vert), onPressed: () {})],
      ),
      body: Column(children: [
        SegmentedButton<int>(
          segments: const [ButtonSegment(value: 0, label: Text('IN')), ButtonSegment(value: 1, label: Text('OUT')), ButtonSegment(value: 2, label: Text('ALL'))],
          selected: {view},
          onSelectionChanged: (s) => setState(() => view = s.first),
          showSelectedIcon: false,
        ),
        Expanded(flex: 11, child: CustomPaint(painter: DetailCubePainter(widget.acc, mine, view), child: const SizedBox.expand())),
        Expanded(
          flex: 9,
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 6),
              itemCount: shown.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 16, endIndent: 16),
              itemBuilder: (_, i) {
                final t = shown[i];
                final c = t.isIn ? const Color(0xFF1E8C46) : const Color(0xFFC83232);
                return ListTile(
                  dense: true,
                  leading: Text('${t.isIn ? '+' : '−'}${inr(t.amt)}', style: TextStyle(color: c, fontSize: 18, fontWeight: FontWeight.w800)),
                  title: Text(t.note, style: const TextStyle(fontSize: 16)),
                  trailing: Text('${t.ts.day} ${_mon(t.ts.month)}', style: const TextStyle(color: Color(0xFF5A6473))),
                );
              },
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(color: const Color(0xFFE6F5EA), borderRadius: BorderRadius.circular(12)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Text('Is mahine — ', style: TextStyle(fontWeight: FontWeight.w700)),
            Text('Aaya ${inr(aaya)}', style: const TextStyle(color: Color(0xFF1E8C46), fontWeight: FontWeight.w800)),
            const Text(' · '),
            Text('Gaya ${inr(gaya)}', style: const TextStyle(color: Color(0xFFC83232), fontWeight: FontWeight.w800)),
            const Text(' · '),
            Text('Net ${aaya - gaya >= 0 ? '+' : ''}${inr(aaya - gaya)}', style: const TextStyle(fontWeight: FontWeight.w800)),
          ]),
        ),
      ]),
    );
  }

  String _mon(int m) => const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
}

/// Bada cube + ₹ scale + bands (IN = liquid ke andar stacked bands, OUT = right edge pe red notches)
class DetailCubePainter extends CustomPainter {
  DetailCubePainter(this.acc, this.txns, this.view);
  final Account acc;
  final List<Txn> txns;
  final int view;

  @override
  void paint(Canvas canvas, Size size) {
    final s = math.min(size.width - 120, size.height - 30);
    final rect = Rect.fromCenter(center: Offset(size.width / 2 + 30, size.height / 2), width: s, height: s);
    final rr = RRect.fromRectAndRadius(rect, Radius.circular(s * 0.12));
    final goal = math.max(acc.goal, acc.balance);
    double yFor(double v) => rect.bottom - 4 - (v / goal) * (rect.height - 8);

    // ₹ scale (5 ticks, Indian format)
    for (var i = 0; i <= 4; i++) {
      final v = goal * i / 4;
      final y = yFor(v);
      canvas.drawLine(Offset(rect.left - 10, y), Offset(rect.left - 2, y), Paint()..color = const Color(0xFF8C96A5)..strokeWidth = 1.5);
      final tp = TextPainter(text: TextSpan(text: inr(v), style: const TextStyle(fontSize: 12, color: Color(0xFF5A6473))), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(rect.left - 16 - tp.width, y - tp.height / 2));
    }

    canvas.drawShadow(Path()..addRRect(rr.shift(const Offset(0, 8))), const Color(0xFF14284F), 8, false);
    canvas.drawRRect(rr, Paint()..color = Color.lerp(Colors.white, acc.color, 0.12)!);
    canvas.save();
    canvas.clipRRect(rr);
    canvas.drawRect(Rect.fromLTRB(rect.left, yFor(acc.balance), rect.right, rect.bottom), Paint()..color = acc.color.withAlpha(215));
    // IN bands: bottom se stack, height = amount
    if (view != 1) {
      var base = 0.0;
      final ins = txns.where((t) => t.isIn).toList().reversed;
      for (final t in ins) {
        final top = yFor(base + t.amt), bot = yFor(base);
        canvas.drawRect(Rect.fromLTRB(rect.left, top, rect.right, bot), Paint()..color = Colors.white.withAlpha(60));
        canvas.drawLine(Offset(rect.left, top), Offset(rect.right, top), Paint()..color = Colors.white.withAlpha(150));
        final tp = TextPainter(text: TextSpan(text: '+${t.amt.round()}', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)), textDirection: TextDirection.ltr)..layout();
        if (bot - top > 18) tp.paint(canvas, Offset(rect.center.dx - tp.width / 2, (top + bot) / 2 - tp.height / 2));
        base += t.amt;
        if (base > acc.balance) break;
      }
    }
    // OUT notches: right edge pe red marks
    if (view != 0) {
      var lvl = acc.balance;
      for (final t in txns.where((t) => !t.isIn)) {
        final y = yFor(lvl);
        final h = (t.amt / goal) * (rect.height - 8);
        canvas.drawRect(Rect.fromLTRB(rect.right - 14, y, rect.right, y + h), Paint()..color = const Color(0xFFE14646).withAlpha(200));
        final tp = TextPainter(text: TextSpan(text: '−${t.amt.round()}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFFC83232))), textDirection: TextDirection.ltr)..layout();
        tp.paint(canvas, Offset(rect.right - 20 - tp.width, y + h / 2 - tp.height / 2));
        lvl += t.amt;
      }
    }
    canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(rect.left + 14, rect.top + 10, s * 0.5, 22), const Radius.circular(12)), Paint()..color = Colors.white.withAlpha(90));
    canvas.restore();
    canvas.drawRRect(rr, Paint()..style = PaintingStyle.stroke..strokeWidth = 2..color = Color.lerp(acc.color, Colors.black, 0.3)!.withAlpha(170));
    final big = TextPainter(text: TextSpan(text: inr(acc.balance), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Colors.white)), textDirection: TextDirection.ltr)..layout();
    big.paint(canvas, Offset(rect.center.dx - big.width / 2, yFor(acc.balance) + 10));
  }

  @override
  bool shouldRepaint(covariant DetailCubePainter old) => old.view != view || old.acc != acc || old.txns.length != txns.length;
}
