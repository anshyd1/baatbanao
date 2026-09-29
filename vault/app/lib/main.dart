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

import 'shell.dart';

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
      home: const BootScreen(),
    );
  }
}

// =========================== MODEL ===========================

class Account {
  Account({
    required this.n,
    required this.name,
    required this.balance,
    required this.goal,
    required this.color,
    this.locked = false,
    this.type = 'custom',
    this.lowBalanceAt = 0,
    this.historicallyUsed = false,
  });
  final int n; // stable box number; moving a cube never changes its identity
  String name;
  String type;
  double balance;
  double goal; // scale ka top (auto-adjust: balance > goal ho to goal = balance)
  Color color;
  double lowBalanceAt;
  /// Once true, a box is never eligible for permanent deletion. This survives
  /// the 2,000-entry persistence window so old history cannot be forgotten.
  bool historicallyUsed;
  /// Locked Box: balance is derived from the Khata (receivables) and cannot be edited directly.
  bool locked;
  double get pct => goal <= 0 ? 0 : (balance / goal).clamp(0.0, 1.0).toDouble();
  bool get isLow => !locked && lowBalanceAt > 0 && balance <= lowBalanceAt;

  Map<String, dynamic> toJson() => {
        'n': n,
        'name': name,
        'type': type,
        'balance': balance,
        'goal': goal,
        'lowBalanceAt': lowBalanceAt,
        'historicallyUsed': historicallyUsed,
        'color': color.toARGB32(),
        'locked': locked,
      };
  factory Account.fromJson(Map<String, dynamic> j) => Account(
        n: (j['n'] as num).toInt(),
        name: (j['name'] ?? 'Box').toString(),
        type: (j['type'] ?? 'custom').toString(),
        balance: ((j['balance'] ?? 0) as num).toDouble(),
        goal: ((j['goal'] ?? 2000) as num).toDouble(),
        lowBalanceAt: ((j['lowBalanceAt'] ?? 0) as num).toDouble(),
        historicallyUsed: j['historicallyUsed'] == true,
        color: Color(((j['color'] ?? 0xFF3478F6) as num).toInt()),
        locked: j['locked'] == true,
      );
}

class Txn {
  Txn(this.accN, this.amt, this.note, this.isIn, this.ts, {this.transferId = '', this.category = '', this.party = '', this.source = ''});
  final int accN;
  final double amt;
  final String note;
  final bool isIn; // true = aaya (green), false = gaya (red)
  final DateTime ts;
  final String transferId; // same ID on both sides of a transfer
  final String category;
  final String party;
  final String source;

  Map<String, dynamic> toJson() => {
        'accN': accN,
        'amt': amt,
        'note': note,
        'isIn': isIn,
        'ts': ts.millisecondsSinceEpoch,
        'transferId': transferId,
        'category': category,
        'party': party,
        'source': source,
      };
  factory Txn.fromJson(Map<String, dynamic> j) => Txn(
        (j['accN'] as num).toInt(),
        ((j['amt'] ?? 0) as num).toDouble(),
        (j['note'] ?? '').toString(),
        j['isIn'] == true,
        DateTime.fromMillisecondsSinceEpoch(((j['ts'] ?? 0) as num).toInt()),
        transferId: (j['transferId'] ?? '').toString(),
        category: (j['category'] ?? '').toString(),
        party: (j['party'] ?? '').toString(),
        source: (j['source'] ?? '').toString(),
      );
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
      Account(n: 8, name: 'Udhaar', balance: 0, goal: 2000, color: const Color(0xFF828C96), locked: true), // Locked Box: Khata se derived
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

class _PointerControl {
  _PointerControl({required this.id, required this.body, required this.downAt, required this.start, required this.last, required this.grab});
  final int id;
  final CubeBody body;
  final double downAt;
  final Offset start;
  Offset last;
  final Offset grab;
  Offset velocity = Offset.zero;
  bool moved = false;
  bool lifted = false;
  bool longPressAllowed = true;
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
  World(List<Account> accounts, this.txns, {List<Account> archivedAccounts = const []}) {
    for (final a in accounts) {
      bodies.add(CubeBody(a)..displayBal = a.balance);
    }
    for (final a in archivedAccounts) {
      archivedBodies.add(CubeBody(a)..displayBal = a.balance);
    }
    // Older saves did not have the durable flag. Infer it from whatever
    // timeline is available, then future writes preserve it forever.
    for (final t in txns) {
      for (final b in [...bodies, ...archivedBodies]) {
        if (b.acc.n == t.accN) b.acc.historicallyUsed = true;
      }
    }
  }
  static const int maxFree = 5, maxPro = 12;

  /// Called after every balance mutation (persistence hook).
  void Function()? onData;
  /// Store wires this callback so preferences use the same JSON save path as balances.
  void Function()? onPreferencesChanged;
  bool hapticsEnabled = true;
  bool soundEnabled = false;
  bool reduceMotion = false;
  bool lowBalanceAlerts = true;
  bool overdueAlerts = true;
  /// Only called when the number/order of visible cubes changes. This avoids rebuilding
  /// the whole screen on every 60fps physics tick.
  void Function()? onStructureChanged;
  /// Low-frequency model changes for management/detail screens. Physics still uses
  /// ChangeNotifier for the tray painter, but list screens should not rebuild at 60fps.
  final ValueNotifier<int> dataVersion = ValueNotifier<int>(0);

  bool get hasLowBalances => lowBalanceAlerts && bodies.any((b) => b.acc.isLow);

  void hapticSelection() {
    if (hapticsEnabled) HapticFeedback.selectionClick();
  }

  void hapticLight() {
    if (hapticsEnabled) HapticFeedback.lightImpact();
  }

  void hapticMedium() {
    if (hapticsEnabled) HapticFeedback.mediumImpact();
  }

  void soundClick() {
    if (soundEnabled) SystemSound.play(SystemSoundType.click);
  }

  void updatePreferences({bool? haptics, bool? sound, bool? motion, bool? lowAlerts, bool? overdue}) {
    if (haptics != null) hapticsEnabled = haptics;
    if (sound != null) soundEnabled = sound;
    if (motion != null) reduceMotion = motion;
    if (lowAlerts != null) lowBalanceAlerts = lowAlerts;
    if (overdue != null) overdueAlerts = overdue;
    onPreferencesChanged?.call();
    dataVersion.value++;
    onData?.call();
    notifyListeners();
  }

  CubeBody? get lockedBody {
    for (final b in bodies) {
      if (b.acc.locked) return b;
    }
    return null;
  }

  final List<CubeBody> bodies = [];
  final List<CubeBody> archivedBodies = [];
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

  /// Liquid money only (locked/receivable boxes excluded).
  double get total => bodies.where((b) => !b.acc.locked).fold(0.0, (s, b) => s + b.acc.balance);
  double get lockedTotal => bodies.where((b) => b.acc.locked).fold(0.0, (s, b) => s + b.acc.balance);

  CubeBody byN(int n) => bodies.firstWhere((b) => b.acc.n == n);

  List<Account> get archivedAccounts => archivedBodies.map((b) => b.acc).toList(growable: false);

  int get nextBoxNumber {
    final all = <CubeBody>[...bodies, ...archivedBodies];
    return all.isEmpty ? 1 : all.map((b) => b.acc.n).reduce((a, b) => a > b ? a : b) + 1;
  }

  void _persist({bool structure = false}) {
    onData?.call();
    dataVersion.value++;
    notifyListeners();
    if (structure) onStructureChanged?.call();
  }

  void relayout() {
    _placed = false;
    tray = Size.zero;
    slots = [];
  }

  String? addBox({required String name, required String type, required double goal, required double lowBalanceAt, required Color color, double openingBalance = 0}) {
    final clean = name.trim();
    if (clean.isEmpty) return 'Box name zaroori hai';
    if (!goal.isFinite || goal <= 0) return 'Goal amount sahi daalo';
    if (!lowBalanceAt.isFinite || lowBalanceAt < 0) return 'Low balance alert sahi daalo';
    if (!openingBalance.isFinite || openingBalance < 0) return 'Opening balance sahi daalo';
    final account = Account(n: nextBoxNumber, name: clean, type: type, balance: openingBalance, goal: goal > openingBalance ? goal : openingBalance, lowBalanceAt: lowBalanceAt, color: color, historicallyUsed: openingBalance > 0);
    bodies.add(CubeBody(account)..displayBal = openingBalance);
    if (openingBalance > 0) {
      txns.insert(0, Txn(account.n, openingBalance, 'Opening balance · $clean', true, DateTime.now()));
    }
    relayout();
    _persist(structure: true);
    return null;
  }

  String? updateBox(Account account, {required String name, required String type, required double goal, required double lowBalanceAt, required Color color}) {
    if (account.locked) return 'Locked Khata ko yahan edit nahi kar sakte';
    final clean = name.trim();
    if (clean.isEmpty) return 'Box name zaroori hai';
    if (!goal.isFinite || goal <= 0) return 'Goal amount sahi daalo';
    if (!lowBalanceAt.isFinite || lowBalanceAt < 0) return 'Low balance alert sahi daalo';
    account.name = clean;
    account.type = type;
    account.goal = goal > account.balance ? goal : account.balance;
    account.lowBalanceAt = lowBalanceAt;
    account.color = color;
    _persist();
    return null;
  }

  String? archiveBox(int n) {
    final i = bodies.indexWhere((b) => b.acc.n == n);
    if (i < 0) return 'Box nahi mila';
    final body = bodies[i];
    if (body.acc.locked) return 'Locked Khata archive nahi hota';
    if (body.acc.balance.abs() > 0.01) return 'Pehle is box ka balance transfer karke zero karo';
    archivedBodies.add(bodies.removeAt(i));
    relayout();
    _persist(structure: true);
    return null;
  }

  String? restoreBox(int n) {
    final i = archivedBodies.indexWhere((b) => b.acc.n == n);
    if (i < 0) return 'Archived box nahi mila';
    bodies.add(archivedBodies.removeAt(i));
    relayout();
    _persist(structure: true);
    return null;
  }

  String? deleteBox(int n) {
    final activeIndex = bodies.indexWhere((b) => b.acc.n == n);
    final archivedIndex = archivedBodies.indexWhere((b) => b.acc.n == n);
    if (activeIndex < 0 && archivedIndex < 0) return 'Box nahi mila';
    final body = activeIndex >= 0 ? bodies[activeIndex] : archivedBodies[archivedIndex];
    if (body.acc.locked) return 'Locked Khata delete nahi hota';
    if (body.acc.balance.abs() > 0.01) return 'Non-zero box delete nahi ho sakta';
    if (body.acc.historicallyUsed || txns.any((t) => t.accN == n)) return 'History hai — box ko Archive karo';
    if (activeIndex >= 0) {
      bodies.removeAt(activeIndex);
      relayout();
    } else {
      archivedBodies.removeAt(archivedIndex);
    }
    _persist(structure: true);
    return null;
  }

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
    hapticLight();
  }

  void _bump(Offset p, double strength) {
    if (!reduceMotion) bumps.add(Bump(p, time, strength));
    if (time - _lastHaptic > 0.08) {
      _lastHaptic = time;
      hapticLight(); // "haptic tick" har takkar pe (rate-limited)
      soundClick();
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
      final f = math.pow(reduceMotion ? 0.12 : 0.35, dt).toDouble(); // reduce motion = faster settle
      final fa = math.pow(reduceMotion ? 0.04 : 0.2, dt).toDouble();
      for (final b in bodies) {
        if (b.kinematic) continue;
        b.pos += b.vel * dt;
        b.ang += b.angV * dt;
        b.vel *= f;
        b.angV *= fa;
        if (reduceMotion) {
          b.ang *= 0.8;
          if (b.ang.abs() < 0.01) b.ang = 0;
        }
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

  /// +Aaya / −Kharch apply. Kisi bhi cash box ka balance negative nahi ja sakta.
  bool apply(int n, double amt, bool isIn, String note, {bool force = false, DateTime? timestamp, String category = '', String party = '', String source = ''}) {
    if (!amt.isFinite || amt <= 0) return false;
    final b = byN(n);
    if (b.acc.locked && !force) return false; // Locked Box: Khata se chalta hai
    if (!isIn && b.acc.balance - amt < 0) return false;
    b.acc.balance += isIn ? amt : -amt;
    if (b.acc.balance < 0 && b.acc.locked) b.acc.balance = 0;
    if (b.acc.balance > b.acc.goal) b.acc.goal = b.acc.balance; // scale auto-adjust
    b.acc.historicallyUsed = true;
    txns.insert(0, Txn(n, amt, note, isIn, timestamp ?? DateTime.now(), category: category, party: party, source: source));
    b.pourUntil = time + 1.3;
    b.pourIn = isIn;
    hapticMedium();
    soundClick();
    dataVersion.value++;
    onData?.call();
    return true;
  }

  String? undo(Txn target) {
    if (!txns.contains(target)) return 'Ye entry already change ho chuki hai';
    if (target.transferId.isNotEmpty) {
      final pair = txns.where((t) => t.transferId == target.transferId).toList();
      for (final t in pair) {
        final bodyIndex = bodies.indexWhere((b) => b.acc.n == t.accN);
        if (bodyIndex < 0 || bodies[bodyIndex].acc.locked) return 'Transfer undo nahi ho sakta';
        final body = bodies[bodyIndex];
        if (t.isIn && body.acc.balance + 0.001 < t.amt) return 'Destination balance badal chuka hai';
      }
      for (final t in pair) {
        final body = byN(t.accN);
        body.acc.balance += t.isIn ? -t.amt : t.amt;
        txns.remove(t);
      }
    } else {
      final bodyIndex = bodies.indexWhere((b) => b.acc.n == target.accN);
      if (bodyIndex < 0) return 'Box nahi mila';
      final body = bodies[bodyIndex];
      if (body.acc.locked) return 'Locked Khata entry yahan undo nahi hoti';
      if (target.isIn && body.acc.balance + 0.001 < target.amt) return 'Balance badal chuka hai — undo safe nahi hai';
      body.acc.balance += target.isIn ? -target.amt : target.amt;
      txns.remove(target);
    }
    hapticLight();
    dataVersion.value++;
    onData?.call();
    return null;
  }

  String? transfer(int fromN, int toN, double amt, String note, {DateTime? timestamp}) {
    if (fromN == toN) return 'Source aur destination alag hone chahiye';
    if (!amt.isFinite || amt <= 0) return 'Transfer amount sahi daalo';
    final fromIndex = bodies.indexWhere((b) => b.acc.n == fromN);
    final toIndex = bodies.indexWhere((b) => b.acc.n == toN);
    if (fromIndex < 0 || toIndex < 0) return 'Box nahi mila';
    final from = bodies[fromIndex], to = bodies[toIndex];
    if (from.acc.locked || to.acc.locked) return 'Locked Khata me direct transfer nahi hota';
    if (from.acc.balance + 0.001 < amt) return 'Source box me itna balance nahi hai';
    final cleanNote = note.trim().isEmpty ? 'Box transfer' : note.trim();
    final ts = timestamp ?? DateTime.now();
    final id = 'tr-${ts.microsecondsSinceEpoch}-$fromN-$toN';
    from.acc.balance -= amt;
    to.acc.balance += amt;
    from.acc.historicallyUsed = true;
    to.acc.historicallyUsed = true;
    if (to.acc.balance > to.acc.goal) to.acc.goal = to.acc.balance;
    txns.insert(0, Txn(fromN, amt, '$cleanNote · to Box $toN', false, ts, transferId: id, category: 'Transfer', source: 'Box $toN'));
    txns.insert(0, Txn(toN, amt, '$cleanNote · from Box $fromN', true, ts, transferId: id, category: 'Transfer', source: 'Box $fromN'));
    from.pourUntil = time + 1.3;
    from.pourIn = false;
    to.pourUntil = time + 1.3;
    to.pourIn = true;
    hapticMedium();
    soundClick();
    dataVersion.value++;
    onData?.call();
    return null;
  }

  /// Set a locked box to an exact derived value (no txn record).
  void setLockedBalance(double v, {bool animate = true}) {
    final b = lockedBody;
    if (b == null) return;
    final up = v > b.acc.balance;
    if (animate && (v - b.acc.balance).abs() > 0.5) {
      b.pourUntil = time + 1.3;
      b.pourIn = up;
    }
    b.acc.balance = v < 0 ? 0 : v;
    if (b.acc.balance > b.acc.goal) b.acc.goal = b.acc.balance;
    if (!animate) b.displayBal = b.acc.balance;
    dataVersion.value++;
    onData?.call();
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

    if (b.acc.locked) {
      // frost: locked money (receivables) — white haze + lock glyph
      canvas.drawRRect(rr, Paint()..color = Colors.white.withAlpha(115));
      final lk = s / 150;
      final lc = Offset(hs - 24 * lk, hs - 24 * lk);
      canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: lc + Offset(0, 4 * lk), width: 18 * lk, height: 14 * lk), Radius.circular(3 * lk)), Paint()..color = const Color(0xFF505A66));
      canvas.drawArc(
        Rect.fromCenter(center: lc - Offset(0, 4 * lk), width: 12 * lk, height: 14 * lk),
        math.pi,
        math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5 * lk
          ..color = const Color(0xFF505A66),
      );
    }

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
  const HomeScreen({super.key, required this.world});
  final World world;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  World get world => widget.world;
  late final Ticker _ticker;
  Duration _last = Duration.zero;
  final Map<int, _PointerControl> _pointers = {};

  @override
  void initState() {
    super.initState();
    world.onStructureChanged = _onStructureChanged;
    _ticker = createTicker(_onTick)..start();
  }

  void _onStructureChanged() {
    if (mounted) setState(() {});
  }

  void _onTick(Duration elapsed) {
    var dt = (elapsed - _last).inMicroseconds / 1e6;
    _last = elapsed;
    if (dt <= 0 || dt > 0.05) dt = 1 / 60; // frame drop / first frame guard
    world.step(dt);
    _updateLongPresses();
  }

  @override
  void dispose() {
    for (final control in _pointers.values) {
      control.body.kinematic = false;
      control.body.lifted = false;
    }
    _pointers.clear();
    world.onStructureChanged = null;
    _ticker.dispose();
    super.dispose();
  }

  // ---------- multi-pointer cube control ----------
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

  void _updateLongPresses() {
    for (final control in _pointers.values) {
      if (control.lifted || !control.longPressAllowed) continue;
      if (world.time - control.downAt < 0.42) continue;
      control.lifted = true;
      control.body.lifted = true;
      world.hapticMedium();
    }
  }

  void _pointerDown(PointerDownEvent event) {
    if (world.findN != null) world.setFind(null);
    final body = _hit(event.localPosition);
    if (body == null || _pointers.values.any((p) => identical(p.body, body))) return;
    body.kinematic = true;
    _pointers[event.pointer] = _PointerControl(
      id: event.pointer,
      body: body,
      downAt: world.time,
      start: event.localPosition,
      last: event.localPosition,
      grab: event.localPosition - body.pos,
    );
    world.hapticSelection();
  }

  void _pointerMove(PointerMoveEvent event) {
    final control = _pointers[event.pointer];
    if (control == null) return;
    final delta = event.localPosition - control.last;
    control.last = event.localPosition;
    if ((event.localPosition - control.start).distance > 12 && !control.lifted) {
      control.longPressAllowed = false;
    }
    if (delta.distance > 0.5) control.moved = true;
    control.body.pos = _clampInTray(event.localPosition - control.grab);
    control.velocity = delta * 60;
    control.body.vel = control.velocity;
    if (control.lifted) {
      control.body.ang = (-delta.dx * 0.02).clamp(-0.14, 0.14).toDouble();
    }
  }

  void _finishPointer(int pointer, {bool cancelled = false}) {
    final control = _pointers.remove(pointer);
    if (control == null) return;
    final body = control.body;
    final duration = world.time - control.downAt;
    final tap = !cancelled && !control.moved && !control.lifted && duration < 0.42;
    body.lifted = false;
    body.kinematic = false;
    if (tap) {
      body.vel = Offset.zero;
      body.angV = 0;
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(acc: body.acc, txns: world.txns, world: world)));
      return;
    }
    var velocity = cancelled ? Offset.zero : control.velocity;
    if (velocity.distance > 2500) velocity = velocity / velocity.distance * 2500;
    body.vel = velocity;
    body.angV = ((control.grab.dx * velocity.dy - control.grab.dy * velocity.dx) * 0.00005).clamp(-6.0, 6.0).toDouble();
    world.hapticLight();
  }

  void _pointerUp(PointerUpEvent event) => _finishPointer(event.pointer);
  void _pointerCancel(PointerCancelEvent event) => _finishPointer(event.pointer, cancelled: true);

  // ---------- sheets ----------
  Future<void> _findBox() async {
    final n = await showModalBottomSheet<int>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
      builder: (_) => FindBoxSheet(accounts: world.bodies.map((b) => b.acc).toList(), onHaptic: world.hapticSelection),
    );
    if (n == null) return;
    world.setFind(n);
    Future.delayed(const Duration(milliseconds: 2600), () {
      if (world.findN == n) world.setFind(null);
    });
  }

  Future<void> _addMoney(bool isIn, {int? preselect}) async {
    await showMoneyEntry(context, world, isIn, preselect: preselect);
  }

  Future<void> _transfer({int? preselectFrom}) async {
    await showTransferSheet(context, world, preselectFrom: preselectFrom);
  }

  Future<void> _openHomeMenu() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const ListTile(title: Text('Vault menu', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20))),
          ListTile(leading: const Icon(Icons.add_box_rounded), title: const Text('Add new box'), onTap: () {
            Navigator.pop(sheetContext);
            showBoxEditor(context, world);
          }),
          ListTile(leading: const Icon(Icons.dashboard_customize_rounded), title: const Text('Manage boxes'), subtitle: Text('${world.bodies.length} active · ${world.archivedBodies.length} archived'), onTap: () {
            Navigator.pop(sheetContext);
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => ManageBoxesScreen(world: world)));
          }),
          ListTile(leading: const Icon(Icons.swap_horiz_rounded), title: const Text('Transfer between boxes'), onTap: () {
            Navigator.pop(sheetContext);
            _transfer();
          }),
          ListTile(leading: const Icon(Icons.warning_amber_rounded), title: const Text('Alerts'), subtitle: Text(world.hasLowBalances ? 'Low-balance boxes need attention' : 'No active box warnings'), onTap: () {
            Navigator.pop(sheetContext);
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => AlertsScreen(world: world)));
          }),
          ListTile(leading: const Icon(Icons.settings_rounded), title: const Text('Preferences'), subtitle: const Text('Sound, haptics and motion'), onTap: () {
            Navigator.pop(sheetContext);
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => PreferencesScreen(world: world)));
          }),
        ]),
      ),
    );
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
              builder: (_, __) => Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        children: [
                          Text('Total ${inr(world.total)} · ${world.bodies.length} boxes',
                              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF14181E))),
                          Padding(
                            padding: const EdgeInsets.only(top: 4, bottom: 10),
                            child: Text(
                              world.lockedTotal > 0
                                  ? 'Locked in Khata ${inr(world.lockedTotal)} · flick · Align · Find · tap = detail'
                                  : 'flick · long-press drag · Align · Find box · tap = detail',
                              style: const TextStyle(fontSize: 13, color: Color(0xFF5A6473)),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(tooltip: 'Menu', icon: const Icon(Icons.menu_rounded), onPressed: _openHomeMenu),
                  ],
                ),
              ),
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
                      return Listener(
                        behavior: HitTestBehavior.opaque,
                        onPointerDown: _pointerDown,
                        onPointerMove: _pointerMove,
                        onPointerUp: _pointerUp,
                        onPointerCancel: _pointerCancel,
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
  const FindBoxSheet({super.key, required this.accounts, this.onHaptic});
  final List<Account> accounts;
  final VoidCallback? onHaptic;
  @override
  State<FindBoxSheet> createState() => _FindBoxSheetState();
}

class _FindBoxSheetState extends State<FindBoxSheet> {
  String typed = '';

  void _press(String k) {
    widget.onHaptic?.call();
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


Future<void> showTransferSheet(BuildContext context, World world, {int? preselectFrom}) async {
  final accounts = world.bodies.where((b) => !b.acc.locked).map((b) => b.acc).toList();
  if (accounts.length < 2) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transfer ke liye kam se kam 2 active boxes chahiye')));
    return;
  }
  final result = await showModalBottomSheet<(int, int, double, String)>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
    builder: (_) => TransferSheet(accounts: accounts, preselectFrom: preselectFrom),
  );
  if (result == null || !context.mounted) return;
  final error = world.transfer(result.$1, result.$2, result.$3, result.$4);
  final created = error == null && world.txns.isNotEmpty ? world.txns.first : null;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(error ?? '${inr(result.$3)} Box ${result.$1} se Box ${result.$2} me transfer ho gaya'),
    backgroundColor: error == null ? const Color(0xFF1E242E) : const Color(0xFFE14646),
    behavior: SnackBarBehavior.floating,
    action: created == null ? null : SnackBarAction(label: 'UNDO', textColor: const Color(0xFF78E696), onPressed: () {
      final undoError = world.undo(created);
      if (undoError != null) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(undoError), backgroundColor: const Color(0xFFE14646)));
    }),
  ));
}

class TransferSheet extends StatefulWidget {
  const TransferSheet({super.key, required this.accounts, this.preselectFrom});
  final List<Account> accounts;
  final int? preselectFrom;

  @override
  State<TransferSheet> createState() => _TransferSheetState();
}

class _TransferSheetState extends State<TransferSheet> {
  late int from;
  late int to;
  final amount = TextEditingController();
  final note = TextEditingController(text: 'Transfer');

  @override
  void initState() {
    super.initState();
    from = widget.accounts.any((a) => a.n == widget.preselectFrom) ? widget.preselectFrom! : widget.accounts.first.n;
    to = widget.accounts.firstWhere((a) => a.n != from, orElse: () => widget.accounts.last).n;
  }

  @override
  void dispose() {
    amount.dispose();
    note.dispose();
    super.dispose();
  }

  double _parseAmount() => double.tryParse(amount.text.replaceAll(',', '').trim()) ?? -1;

  Widget _boxChoice({required String label, required int selected, required ValueChanged<int> onChanged}) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final a in widget.accounts)
            ChoiceChip(
              label: Text('${a.n} ${a.name}', style: const TextStyle(fontWeight: FontWeight.w700)),
              selected: selected == a.n,
              selectedColor: a.color,
              labelStyle: TextStyle(color: selected == a.n ? Colors.white : const Color(0xFF282E38)),
              showCheckmark: false,
              onSelected: (_) {
                if (label == 'From' && a.n == to) setState(() => to = from);
                onChanged(a.n);
              },
            ),
        ],
      );

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 6, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Transfer between boxes', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          const Text('Money source se destination cube me jayega; dono timelines me paired entry banegi.', style: TextStyle(color: Color(0xFF687384))),
          const SizedBox(height: 16),
          const Text('From', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF4E5A6B))),
          const SizedBox(height: 7),
          _boxChoice(label: 'From', selected: from, onChanged: (n) => setState(() {
            from = n;
            if (to == from) to = widget.accounts.firstWhere((a) => a.n != from).n;
          })),
          const SizedBox(height: 14),
          const Text('To', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF4E5A6B))),
          const SizedBox(height: 7),
          _boxChoice(label: 'To', selected: to, onChanged: (n) => setState(() => to = n)),
          const SizedBox(height: 14),
          TextField(controller: amount, autofocus: true, keyboardType: const TextInputType.numberWithOptions(decimal: true), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800), decoration: const InputDecoration(labelText: 'Amount', prefixText: '₹ ', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),),
          const SizedBox(height: 12),
          TextField(controller: note, decoration: const InputDecoration(labelText: 'Note (optional)', prefixIcon: Icon(Icons.notes_rounded), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, height: 56, child: FilledButton.icon(onPressed: () {
            final v = _parseAmount();
            if (v <= 0 || !v.isFinite || from == to) return;
            Navigator.of(context).pop((from, to, v, note.text.trim()));
          }, icon: const Icon(Icons.swap_horiz_rounded), label: const Text('Transfer'))),
        ]),
      ),
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
  final party = TextEditingController();
  DateTime selectedDate = DateTime.now();
  String category = 'Aur';
  static const cats = ['Khana', 'Ghar', 'Safar', 'Udhaar', 'Salary', 'Aur'];

  @override
  void dispose() {
    amt.dispose();
    note.dispose();
    party.dispose();
    super.dispose();
  }

  String _dateLabel(DateTime d) => '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, firstDate: DateTime(2000), lastDate: DateTime.now().add(const Duration(days: 365)), initialDate: selectedDate);
    if (picked != null && mounted) setState(() => selectedDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.isIn ? const Color(0xFF2EA05A) : const Color(0xFFE14646);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 14, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
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
        const Text('Category', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF5A6473))),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final c in cats) ChoiceChip(label: Text(c), selected: category == c, onSelected: (_) => setState(() => category = c), showCheckmark: false)],
        ),
        const SizedBox(height: 8),
        TextField(controller: party, decoration: const InputDecoration(labelText: 'Source / person / vendor (optional)', prefixIcon: Icon(Icons.person_outline_rounded), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))))),
        const SizedBox(height: 8),
        TextField(controller: note, decoration: const InputDecoration(labelText: 'Note', hintText: 'Kirana, Salary…', prefixIcon: Icon(Icons.notes_rounded), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))))),
        const SizedBox(height: 4),
        ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.calendar_today_rounded), title: const Text('Date'), subtitle: Text(_dateLabel(selectedDate)), trailing: const Icon(Icons.chevron_right_rounded), onTap: _pickDate),
        const SizedBox(height: 8),
        SizedBox(
          height: 56,
          width: double.infinity,
          child: FilledButton(
            style: FilledButton.styleFrom(backgroundColor: color, shape: const StadiumBorder(), textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            onPressed: () {
              final v = double.tryParse(amt.text.replaceAll(',', '').trim());
              if (v == null || v <= 0 || !v.isFinite) return;
              Navigator.of(context).pop((box, v, note.text.trim().isEmpty ? (widget.isIn ? 'Aaya' : 'Kharch') : note.text.trim(), category, party.text.trim(), selectedDate));
            },
            child: const Text('Save'),
          ),
        ),
        ]),
      ),
    );
  }
}


Future<void> showMoneyEntry(BuildContext context, World world, bool isIn, {int? preselect}) async {
  final result = await showModalBottomSheet<(int, double, String, String, String, DateTime)>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
    builder: (_) => AddMoneySheet(isIn: isIn, accounts: world.bodies.map((b) => b.acc).toList(), preselect: preselect),
  );
  if (result == null || !context.mounted) return;
  final ok = world.apply(result.$1, result.$2, isIn, result.$3, timestamp: result.$6, category: result.$4, party: result.$5, source: result.$5);
  final msg = ok
      ? 'Box ${result.$1} · ${world.byN(result.$1).acc.name}   ${isIn ? '+' : '−'}${inr(result.$2)}'
      : (world.byN(result.$1).acc.locked ? 'Box ${result.$1} locked hai — ye Khata se chalta hai (udhaar wahan likho)' : 'Balance negative nahi ho sakta — pehle is box me paisa add karo');
  final created = ok ? world.txns.first : null;
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(msg, style: TextStyle(color: ok ? const Color(0xFF78E696) : Colors.white, fontWeight: FontWeight.w700)),
    backgroundColor: ok ? const Color(0xFF1E242E) : const Color(0xFFE14646),
    behavior: SnackBarBehavior.floating,
    duration: const Duration(milliseconds: 2600),
    action: created == null ? null : SnackBarAction(label: 'UNDO', textColor: const Color(0xFF78E696), onPressed: () {
      final error = world.undo(created);
      if (error != null) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error), backgroundColor: const Color(0xFFE14646)));
    }),
  ));
}

// =========================== ALERTS + PREFERENCES ===========================

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key, required this.world});
  final World world;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: ValueListenableBuilder<int>(
        valueListenable: world.dataVersion,
        builder: (context, _, __) {
          final low = world.lowBalanceAlerts ? world.bodies.where((b) => b.acc.isLow).toList() : <CubeBody>[];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: low.isEmpty ? const Color(0xFFE6F5EA) : const Color(0xFFFFF1DD), borderRadius: BorderRadius.circular(20)),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(low.isEmpty ? Icons.verified_rounded : Icons.warning_amber_rounded, color: low.isEmpty ? const Color(0xFF1E8C46) : const Color(0xFFB86B00)),
                  const SizedBox(width: 12),
                  Expanded(child: Text(low.isEmpty ? 'All active cubes are above their alert threshold.' : '${low.length} box${low.length == 1 ? '' : 'es'} low balance par hai.', style: const TextStyle(fontWeight: FontWeight.w800, height: 1.3))),
                ]),
              ),
              const SizedBox(height: 18),
              if (low.isNotEmpty) ...[
                const _SectionLabel('LOW BALANCE'),
                for (final body in low)
                  Card(
                    elevation: 0,
                    child: ListTile(
                      leading: _MiniCube(account: body.acc, size: 48),
                      title: Text('Box ${body.acc.n} · ${body.acc.name}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text('${inr(body.acc.balance)} left · alert at ${inr(body.acc.lowBalanceAt)}'),
                    ),
                  ),
              ],
              const SizedBox(height: 14),
              const _SectionLabel('SAFETY'),
              const ListTile(leading: Icon(Icons.lock_outline_rounded), title: Text('Locked Khata is protected'), subtitle: Text('Udhaar balance sirf Khata entries se badalta hai.')),
              const ListTile(leading: Icon(Icons.inventory_2_outlined), title: Text('Archive before deleting history'), subtitle: Text('Balance ya timeline wale boxes permanently delete nahi hote.')),
              const ListTile(leading: Icon(Icons.receipt_long_outlined), title: Text('Overdue Khata'), subtitle: Text('Detailed due-date alerts Khata tab me dikhte hain.')),
            ],
          );
        },
      ),
    );
  }
}

class PreferencesScreen extends StatefulWidget {
  const PreferencesScreen({super.key, required this.world});
  final World world;

  @override
  State<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends State<PreferencesScreen> {
  World get world => widget.world;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Preferences')),
      body: ValueListenableBuilder<int>(
        valueListenable: world.dataVersion,
        builder: (context, _, __) => ListView(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 28),
          children: [
            const _SectionLabel('FEEDBACK'),
            SwitchListTile(
              secondary: const Icon(Icons.volume_up_rounded),
              title: const Text('Cube sounds'),
              subtitle: const Text('Click/pour feedback; off by default'),
              value: world.soundEnabled,
              onChanged: (v) => world.updatePreferences(sound: v),
            ),
            SwitchListTile(
              secondary: const Icon(Icons.vibration_rounded),
              title: const Text('Haptic feedback'),
              subtitle: const Text('Bump, select and save vibrations'),
              value: world.hapticsEnabled,
              onChanged: (v) => world.updatePreferences(haptics: v),
            ),
            SwitchListTile(
              secondary: const Icon(Icons.motion_photos_off_rounded),
              title: const Text('Reduce motion'),
              subtitle: const Text('Keep the liquid tray calmer'),
              value: world.reduceMotion,
              onChanged: (v) => world.updatePreferences(motion: v),
            ),
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, child: OutlinedButton.icon(onPressed: world.soundEnabled ? world.soundClick : null, icon: const Icon(Icons.play_arrow_rounded), label: const Text('Test sound'))),
            const SizedBox(height: 20),
            const _SectionLabel('WARNINGS'),
            SwitchListTile(
              secondary: const Icon(Icons.warning_amber_rounded),
              title: const Text('Low-balance alerts'),
              subtitle: const Text('Show boxes below their personal threshold'),
              value: world.lowBalanceAlerts,
              onChanged: (v) => world.updatePreferences(lowAlerts: v),
            ),
            SwitchListTile(
              secondary: const Icon(Icons.event_busy_rounded),
              title: const Text('Overdue Khata alerts'),
              subtitle: const Text('Keep due-date warnings visible in Khata'),
              value: world.overdueAlerts,
              onChanged: (v) => world.updatePreferences(overdue: v),
            ),
            const SizedBox(height: 12),
            const _SafetyNote(),
          ],
        ),
      ),
    );
  }
}


// =========================== BOX MANAGEMENT ===========================

/// Opens the same editor for both a new cube and an existing cube. The tray is
/// still the primary surface; this sheet only changes a cube's identity and
/// guardrails, never its existing balance or history.
Future<void> showBoxEditor(BuildContext context, World world, {Account? account}) async {
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
    builder: (_) => BoxEditorSheet(world: world, account: account),
  );
}

enum _BoxAction { add, spend, edit, transfer, archive, restore, delete }

/// Returns true when the current route's cube was removed from the active tray
/// (archive/delete), so a detail screen can close itself after the action.
Future<bool> showBoxActions(BuildContext context, World world, Account account) async {
  final archived = world.archivedBodies.any((b) => b.acc.n == account.n);
  final action = await showModalBottomSheet<_BoxAction>(
    context: context,
    showDragHandle: true,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(34))),
    builder: (sheetContext) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(
          leading: _MiniCube(account: account, size: 46),
          title: Text('Box ${account.n} · ${account.name}', style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: Text('${inr(account.balance)} · ${archived ? 'Archived' : 'Active cube'}'),
        ),
        const Divider(height: 1),
        if (!account.locked && !archived)
          ListTile(
            leading: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFF2E8B57)),
            title: const Text('Add money'),
            subtitle: const Text('Open + Aaya with this cube selected'),
            onTap: () => Navigator.pop(sheetContext, _BoxAction.add),
          ),
        if (!account.locked && !archived)
          ListTile(
            leading: const Icon(Icons.remove_circle_outline_rounded, color: Color(0xFFC83232)),
            title: const Text('Spend money'),
            subtitle: const Text('Open − Kharch with this cube selected'),
            onTap: () => Navigator.pop(sheetContext, _BoxAction.spend),
          ),
        if (!account.locked)
          ListTile(
            leading: const Icon(Icons.edit_rounded),
            title: const Text('Edit box'),
            subtitle: const Text('Name, type, goal and low-balance alert'),
            onTap: () => Navigator.pop(sheetContext, _BoxAction.edit),
          ),
        if (!account.locked && !archived)
          ListTile(
            leading: const Icon(Icons.swap_horiz_rounded),
            title: const Text('Transfer from this box'),
            subtitle: const Text('Move money to another active cube'),
            onTap: () => Navigator.pop(sheetContext, _BoxAction.transfer),
          ),
        if (!account.locked)
          ListTile(
            leading: Icon(archived ? Icons.unarchive_rounded : Icons.archive_rounded),
            title: Text(archived ? 'Restore to tray' : 'Archive box'),
            subtitle: Text(archived ? 'Bring this cube back to Vault' : 'Only a zero-balance box can be archived'),
            onTap: () => Navigator.pop(sheetContext, archived ? _BoxAction.restore : _BoxAction.archive),
          ),
        if (!account.locked)
          ListTile(
            leading: const Icon(Icons.delete_outline_rounded, color: Color(0xFFC83232)),
            title: const Text('Delete permanently', style: TextStyle(color: Color(0xFFC83232))),
            subtitle: const Text('Only an empty box with no history can be deleted'),
            onTap: () => Navigator.pop(sheetContext, _BoxAction.delete),
          ),
        if (account.locked)
          const ListTile(
            leading: Icon(Icons.lock_rounded),
            title: Text('Locked Khata box'),
            subtitle: Text('Iska balance Khata se derived hai; yahan edit, archive ya delete nahi hoga.'),
          ),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (action == null || !context.mounted) return false;

  if (action == _BoxAction.add || action == _BoxAction.spend) {
    await showMoneyEntry(context, world, action == _BoxAction.add, preselect: account.n);
    return false;
  }
  if (action == _BoxAction.edit) {
    await showBoxEditor(context, world, account: account);
    return false;
  }
  if (action == _BoxAction.transfer) {
    await showTransferSheet(context, world, preselectFrom: account.n);
    return false;
  }

  if (action == _BoxAction.delete) {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Delete Box ${account.n}?'),
        content: const Text('Ye sirf tab delete hoga jab balance zero aur transaction history bilkul na ho. Purane box ke liye Archive safer hai.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
          FilledButton.tonal(
            style: FilledButton.styleFrom(foregroundColor: const Color(0xFFC83232)),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return false;
  }

  final error = switch (action) {
    _BoxAction.archive => world.archiveBox(account.n),
    _BoxAction.restore => world.restoreBox(account.n),
    _BoxAction.delete => world.deleteBox(account.n),
    _BoxAction.edit => null,
    _BoxAction.transfer => null,
    _BoxAction.add => null,
    _BoxAction.spend => null,
  };
  if (!context.mounted) return false;
  final removed = error == null && (action == _BoxAction.archive || action == _BoxAction.delete);
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(error ?? (action == _BoxAction.archive ? 'Box archived safely' : action == _BoxAction.restore ? 'Box tray me wapas aa gaya' : 'Box deleted')),
    backgroundColor: error == null ? const Color(0xFF1E242E) : const Color(0xFFE14646),
    behavior: SnackBarBehavior.floating,
  ));
  return removed;
}

class ManageBoxesScreen extends StatefulWidget {
  const ManageBoxesScreen({super.key, required this.world});
  final World world;

  @override
  State<ManageBoxesScreen> createState() => _ManageBoxesScreenState();
}

class _ManageBoxesScreenState extends State<ManageBoxesScreen> {
  World get world => widget.world;

  Future<void> _add() async {
    await showBoxEditor(context, world);
  }

  Future<void> _open(Account account) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailScreen(acc: account, txns: world.txns, world: world)));
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage boxes'),
        actions: [IconButton(tooltip: 'Add box', onPressed: _add, icon: const Icon(Icons.add_box_rounded))],
      ),
      body: ValueListenableBuilder<int>(
        valueListenable: world.dataVersion,
        builder: (context, _, __) {
          final active = world.bodies.map((b) => b.acc).toList();
          final archived = world.archivedBodies.map((b) => b.acc).toList();
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
            children: [
              const _SectionLabel('ACTIVE CUBES'),
              if (active.isEmpty)
                _EmptyBoxesCard(onAdd: _add, archived: false)
              else
                for (final account in active) _BoxManageTile(account: account, archived: false, onTap: () => _open(account), onMenu: () => showBoxActions(context, world, account)),
              const SizedBox(height: 20),
              Row(children: [
                const Expanded(child: _SectionLabel('ARCHIVED')),
                if (archived.isNotEmpty) Text('${archived.length}', style: const TextStyle(color: Color(0xFF687384), fontWeight: FontWeight.w800)),
              ]),
              if (archived.isEmpty)
                const Padding(padding: EdgeInsets.only(top: 4), child: Text('Zero-balance purane cubes yahan safe rehte hain.', style: TextStyle(color: Color(0xFF687384))))
              else
                for (final account in archived) _BoxManageTile(account: account, archived: true, onTap: () => _open(account), onMenu: () => showBoxActions(context, world, account)),
              const SizedBox(height: 18),
              const _SafetyNote(),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(onPressed: _add, icon: const Icon(Icons.add_rounded), label: const Text('Add box')),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(left: 4, bottom: 8),
        child: Text(text, style: const TextStyle(fontSize: 12, letterSpacing: 1.2, fontWeight: FontWeight.w800, color: Color(0xFF687384))),
      );
}

class _BoxManageTile extends StatelessWidget {
  const _BoxManageTile({required this.account, required this.archived, required this.onTap, required this.onMenu});
  final Account account;
  final bool archived;
  final VoidCallback onTap;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final faded = archived ? 0.62 : 1.0;
    return Opacity(
      opacity: faded,
      child: Card(
        margin: const EdgeInsets.only(bottom: 10),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: const BorderSide(color: Color(0xFFD9DFE8))),
        child: ListTile(
          contentPadding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
          leading: _MiniCube(account: account, size: 58),
          title: Text('Box ${account.n} · ${account.name}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('${inr(account.balance)}  ·  goal ${inr(account.goal)}${account.isLow ? '  ·  Low balance' : ''}${archived ? '  ·  Archived' : ''}', style: TextStyle(color: account.isLow ? const Color(0xFFC83232) : const Color(0xFF687384), fontWeight: FontWeight.w600)),
          ),
          onTap: onTap,
          trailing: IconButton(tooltip: 'Box actions', onPressed: onMenu, icon: const Icon(Icons.more_vert_rounded)),
        ),
      ),
    );
  }
}

class _MiniCube extends StatelessWidget {
  const _MiniCube({required this.account, required this.size});
  final Account account;
  final double size;

  @override
  Widget build(BuildContext context) {
    final pct = account.goal <= 0 ? 0.0 : (account.balance / account.goal).clamp(0.0, 1.0).toDouble();
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Color.lerp(Colors.white, account.color, 0.18),
        borderRadius: BorderRadius.circular(size * 0.2),
        border: Border.all(color: account.color.withAlpha(150), width: 2),
        boxShadow: const [BoxShadow(color: Color(0x160F2038), blurRadius: 5, offset: Offset(0, 3))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(alignment: Alignment.center, children: [
        Align(alignment: Alignment.bottomCenter, child: FractionallySizedBox(heightFactor: pct == 0 ? 0.02 : pct, widthFactor: 1, child: ColoredBox(color: account.color.withAlpha(185)))),
        Text('${account.n}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF182230))),
      ]),
    );
  }
}

class _EmptyBoxesCard extends StatelessWidget {
  const _EmptyBoxesCard({required this.onAdd, required this.archived});
  final VoidCallback onAdd;
  final bool archived;

  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(children: [
            Icon(archived ? Icons.inventory_2_outlined : Icons.view_in_ar_outlined, size: 36, color: const Color(0xFF718096)),
            const SizedBox(height: 8),
            Text(archived ? 'No archived boxes' : 'Tray me abhi koi cube nahi', style: const TextStyle(fontWeight: FontWeight.w800)),
            if (!archived) ...[
              const SizedBox(height: 4),
              const Text('Ek naya rounded liquid cube banao.', style: TextStyle(color: Color(0xFF687384))),
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: onAdd, icon: const Icon(Icons.add_rounded), label: const Text('Add box')),
            ],
          ]),
        ),
      );
}

class _SafetyNote extends StatelessWidget {
  const _SafetyNote();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFFEAF1FF), borderRadius: BorderRadius.circular(16)),
        child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.shield_outlined, color: Color(0xFF2F5FAE)),
          SizedBox(width: 10),
          Expanded(child: Text('Safety: balance ya history wale box ko delete nahi kar sakte. Use pehle zero karke Archive karo; existing cube aur Khata data safe rahega.', style: TextStyle(color: Color(0xFF294875), height: 1.35))),
        ]),
      );
}

class BoxEditorSheet extends StatefulWidget {
  const BoxEditorSheet({super.key, required this.world, this.account});
  final World world;
  final Account? account;

  @override
  State<BoxEditorSheet> createState() => _BoxEditorSheetState();
}

class _BoxEditorSheetState extends State<BoxEditorSheet> {
  late final TextEditingController name;
  late final TextEditingController goal;
  late final TextEditingController lowBalanceAt;
  late final TextEditingController opening;
  late String type;
  late Color color;
  bool saving = false;

  bool get editing => widget.account != null;

  @override
  void initState() {
    super.initState();
    final a = widget.account;
    name = TextEditingController(text: a?.name ?? '');
    goal = TextEditingController(text: a == null ? '2000' : _moneyInput(a.goal));
    lowBalanceAt = TextEditingController(text: a == null || a.lowBalanceAt <= 0 ? '' : _moneyInput(a.lowBalanceAt));
    opening = TextEditingController();
    const typeChoices = ['Cash', 'Savings', 'Business', 'Goal', 'Custom'];
    type = a != null && typeChoices.contains(a.type) ? a.type : 'Custom';
    color = a?.color ?? const Color(0xFF3478F6);
  }

  String _moneyInput(double value) => value.round().toString();

  @override
  void dispose() {
    name.dispose();
    goal.dispose();
    lowBalanceAt.dispose();
    opening.dispose();
    super.dispose();
  }

  double _amount(TextEditingController c) => double.tryParse(c.text.replaceAll(',', '').trim()) ?? -1;

  Future<void> _save() async {
    if (saving) return;
    setState(() => saving = true);
    final g = _amount(goal);
    final low = lowBalanceAt.text.trim().isEmpty ? 0.0 : _amount(lowBalanceAt);
    final result = editing
        ? widget.world.updateBox(widget.account!, name: name.text, type: type, goal: g, lowBalanceAt: low, color: color)
        : widget.world.addBox(name: name.text, type: type, goal: g, lowBalanceAt: low, color: color, openingBalance: opening.text.trim().isEmpty ? 0 : _amount(opening));
    if (!mounted) return;
    if (result != null) {
      setState(() => saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result), backgroundColor: const Color(0xFFE14646)));
      return;
    }
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final locked = widget.account?.locked == true;
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 18 + bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(editing ? 'Edit box' : 'Add new box', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(editing ? 'Cube ${widget.account!.n} ki identity aur alerts update karo.' : 'Ek naya rounded liquid cube tray me add hoga.', style: const TextStyle(color: Color(0xFF687384))),
          const SizedBox(height: 16),
          TextField(controller: name, enabled: !locked, textInputAction: TextInputAction.next, decoration: const InputDecoration(labelText: 'Box name', hintText: 'e.g. Travel, Ghar, Savings', prefixIcon: Icon(Icons.label_outline_rounded), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16))))),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: type,
            decoration: const InputDecoration(labelText: 'Type', prefixIcon: Icon(Icons.category_outlined), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
            items: const [
              DropdownMenuItem(value: 'Cash', child: Text('Cash')),
              DropdownMenuItem(value: 'Savings', child: Text('Savings')),
              DropdownMenuItem(value: 'Business', child: Text('Business')),
              DropdownMenuItem(value: 'Goal', child: Text('Goal')),
              DropdownMenuItem(value: 'Custom', child: Text('Custom')),
            ],
            onChanged: locked ? null : (v) => setState(() => type = v ?? type),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: goal,
            enabled: !locked,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Goal / scale top', prefixText: '₹ ', prefixIcon: Icon(Icons.vertical_align_top_rounded), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: lowBalanceAt,
            enabled: !locked,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Low balance alert (optional)', prefixText: '₹ ', prefixIcon: Icon(Icons.warning_amber_rounded), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
          ),
          if (!editing) ...[
            const SizedBox(height: 12),
            TextField(
              controller: opening,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Opening balance (optional)', prefixText: '₹ ', prefixIcon: Icon(Icons.account_balance_wallet_outlined), border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(16)))),
            ),
          ],
          const SizedBox(height: 14),
          const Text('Cube colour', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF4E5A6B))),
          const SizedBox(height: 8),
          Wrap(spacing: 10, children: [
            for (final c in const [Color(0xFF3478F6), Color(0xFF2EA05A), Color(0xFFE59B2F), Color(0xFF9A68D8), Color(0xFFE05C7B), Color(0xFF148CAA)])
              InkWell(
                onTap: locked ? null : () => setState(() => color = c),
                borderRadius: BorderRadius.circular(25),
                child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c, shape: BoxShape.circle, border: Border.all(color: color == c ? Colors.black : Colors.transparent, width: 3))),
              ),
          ]),
          if (locked) ...[
            const SizedBox(height: 14),
            const Text('Locked Khata box ko direct edit nahi kar sakte. Khata tab se uski entries manage hoti hain.', style: TextStyle(color: Color(0xFFC83232), fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 18),
          SizedBox(width: double.infinity, height: 56, child: FilledButton.icon(onPressed: locked || saving ? null : _save, icon: Icon(editing ? Icons.check_rounded : Icons.add_rounded), label: Text(editing ? 'Save changes' : 'Create cube'))),
        ]),
      ),
    );
  }
}


// =========================== DETAIL SCREEN (Frame 7 inside a cube) ===========================

class DetailScreen extends StatefulWidget {
  const DetailScreen({super.key, required this.acc, required this.txns, required this.world});
  final Account acc;
  final List<Txn> txns;
  final World world;
  @override
  State<DetailScreen> createState() => _DetailScreenState();
}

class _DetailScreenState extends State<DetailScreen> {
  int view = 0; // 0 IN, 1 OUT, 2 ALL

  @override
  void initState() {
    super.initState();
    widget.world.dataVersion.addListener(_onWorldData);
  }

  void _onWorldData() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.world.dataVersion.removeListener(_onWorldData);
    super.dispose();
  }

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
        actions: [
          IconButton(
            tooltip: 'Box actions',
            icon: const Icon(Icons.more_vert),
            onPressed: () async {
              final removed = await showBoxActions(context, widget.world, widget.acc);
              if (removed && mounted) Navigator.of(context).pop();
            },
          ),
        ],
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
                  subtitle: [t.category, t.party].where((x) => x.isNotEmpty).join(' · ').isEmpty ? null : Text([t.category, t.party].where((x) => x.isNotEmpty).join(' · ')),
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
  bool shouldRepaint(covariant DetailCubePainter old) =>
      old.view != view || old.txns.length != txns.length || old.acc.balance != acc.balance || old.acc.goal != acc.goal || old.acc.name != acc.name || old.acc.color != acc.color;
}
