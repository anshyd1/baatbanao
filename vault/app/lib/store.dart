// Store: single source of truth (Vault world + Khata + settings) with local JSON persistence.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'khata_model.dart';
import 'main.dart';
import 'web_bridge_stub.dart' if (dart.library.js_interop) 'web_bridge_web.dart';

class Store extends ChangeNotifier {
  Store._(this._prefs, this.world, this.khata, this.settings);

  static const storageKey = 'bb_vault_v1';

  final SharedPreferences _prefs;
  final World world;
  final List<KhataEntry> khata;
  final AppSettings settings;

  /// Tab requested by another screen (e.g. Khata -> "Remind" opens Baat with an entry preselected).
  int? requestedTab;
  String? baatEntryId;
  String lastImportInfo = '';

  Timer? _saveTimer;

  // ------------------------------------------------------------------ load / save
  static Future<Store> load() async {
    final prefs = await SharedPreferences.getInstance();
    Map<String, dynamic>? j;
    final raw = prefs.getString(storageKey);
    if (raw != null && raw.isNotEmpty) {
      try {
        j = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        j = null;
      }
    }

    List<Account> accounts;
    List<Account> archivedAccounts;
    List<Txn> txns;
    List<KhataEntry> khata;
    AppSettings settings;
    var importInfo = '';

    if (j != null) {
      accounts = ((j['accounts'] as List?) ?? []).map((e) => Account.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      archivedAccounts = ((j['archivedAccounts'] as List?) ?? []).map((e) => Account.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      txns = ((j['txns'] as List?) ?? []).map((e) => Txn.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      khata = ((j['khata'] as List?) ?? []).map((e) => KhataEntry.fromJson(Map<String, dynamic>.from(e as Map))).toList();
      settings = AppSettings.fromJson(Map<String, dynamic>.from((j['settings'] as Map?) ?? {}));
      if (accounts.isEmpty) accounts = seedAccounts();
    } else {
      accounts = seedAccounts();
      archivedAccounts = [];
      txns = seedTxns();
      settings = AppSettings();
      khata = [];
      // First run on the web, same origin as the PWA: import the legacy khata automatically.
      final legacy = readLegacyStorage('bb_khata');
      if (legacy != null) {
        try {
          khata = parseKhataList(jsonDecode(legacy));
          importInfo = 'PWA se ${khata.length} khata entries import hui';
        } catch (_) {}
      }
      final legacySettings = readLegacyStorage('bb_settings');
      if (legacySettings != null) {
        try {
          settings = AppSettings.fromJson(Map<String, dynamic>.from(jsonDecode(legacySettings) as Map));
        } catch (_) {}
      }
      if (khata.isEmpty) khata = seedKhata();
    }

    final world = World(accounts, txns, archivedAccounts: archivedAccounts);
    final store = Store._(prefs, world, khata, settings);
    store.lastImportInfo = importInfo;
    store._syncLocked(animate: false);
    world.hapticsEnabled = settings.hapticsEnabled;
    world.soundEnabled = settings.soundEnabled;
    world.reduceMotion = settings.reduceMotion;
    world.lowBalanceAlerts = settings.lowBalanceAlerts;
    world.overdueAlerts = settings.overdueAlerts;
    world.onData = store._dirty;
    world.onPreferencesChanged = () {
      settings.hapticsEnabled = world.hapticsEnabled;
      settings.soundEnabled = world.soundEnabled;
      settings.reduceMotion = world.reduceMotion;
      settings.lowBalanceAlerts = world.lowBalanceAlerts;
      settings.overdueAlerts = world.overdueAlerts;
      store.notifyListeners();
      store._dirty();
    };
    if (j == null) await store.save();
    return store;
  }

  Map<String, dynamic> toJson() => {
        'version': 1,
        'savedAt': DateTime.now().toIso8601String(),
        'accounts': world.bodies.map((b) => b.acc.toJson()).toList(),
        'archivedAccounts': world.archivedAccounts.map((a) => a.toJson()).toList(),
        'txns': world.txns.take(2000).map((t) => t.toJson()).toList(),
        'khata': khata.map((k) => k.toJson()).toList(),
        'settings': settings.toJson(),
      };

  Future<void> save() async {
    _saveTimer?.cancel();
    await _prefs.setString(storageKey, jsonEncode(toJson()));
  }

  void _dirty() {
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), () {
      save();
    });
  }

  // ------------------------------------------------------------------ derived Locked Box
  double get pendingTotal => khata.where((k) => !k.isPaid).fold(0.0, (s, k) => s + k.outstanding);
  int get pendingCount => khata.where((k) => !k.isPaid).length;
  int get overdueCount => khata.where((k) => k.isOverdue).length;

  void _syncLocked({bool animate = true}) {
    world.setLockedBalance(pendingTotal, animate: animate);
  }

  // ------------------------------------------------------------------ khata operations
  KhataEntry? byId(String? id) {
    if (id == null) return null;
    for (final k in khata) {
      if (k.id == id) return k;
    }
    return null;
  }

  List<KhataEntry> get sortedKhata {
    final list = [...khata];
    list.sort((a, b) {
      if (a.isPaid != b.isPaid) return a.isPaid ? 1 : -1;
      if (a.isOverdue != b.isOverdue) return a.isOverdue ? -1 : 1;
      final ad = a.dueDate.isEmpty ? '9999-12-31' : a.dueDate;
      final bd = b.dueDate.isEmpty ? '9999-12-31' : b.dueDate;
      final c = ad.compareTo(bd);
      if (c != 0) return c;
      return b.updatedAt.compareTo(a.updatedAt);
    });
    return list;
  }

  void upsert(KhataEntry e) {
    final i = khata.indexWhere((k) => k.id == e.id);
    final before = i >= 0 ? khata[i].outstanding : 0.0;
    e.updatedAt = DateTime.now();
    e.recomputeStatus();
    if (i >= 0) {
      khata[i] = e;
    } else {
      khata.insert(0, e);
    }
    final delta = e.outstanding - before;
    final lb = world.lockedBody;
    if (lb != null && delta.abs() > 0.5) {
      lb.acc.historicallyUsed = true;
      world.txns.insert(0, Txn(lb.acc.n, delta.abs(), '${delta > 0 ? 'Udhaar' : 'Adjust'} · ${e.name}', delta > 0, DateTime.now()));
    }
    _syncLocked();
    notifyListeners();
    _dirty();
  }

  void remove(String id) {
    final i = khata.indexWhere((k) => k.id == id);
    if (i < 0) return;
    final e = khata.removeAt(i);
    final lb = world.lockedBody;
    if (lb != null && !e.isPaid && e.outstanding > 0.5) {
      lb.acc.historicallyUsed = true;
      world.txns.insert(0, Txn(lb.acc.n, e.outstanding, 'Hataya · ${e.name}', false, DateTime.now()));
    }
    _syncLocked();
    notifyListeners();
    _dirty();
  }

  /// Money received against a khata entry: thaw from the Locked Box, pour into [boxN].
  bool collect(KhataEntry e, double amount, int boxN) {
    if (amount <= 0) return false;
    final target = world.byN(boxN);
    if (target.acc.locked) return false;
    e.paidAmount += amount;
    e.updatedAt = DateTime.now();
    e.recomputeStatus();
    world.apply(boxN, amount, true, 'Vasooli · ${e.name}');
    final lb = world.lockedBody;
    if (lb != null) {
      lb.acc.historicallyUsed = true;
      world.txns.insert(0, Txn(lb.acc.n, amount, 'Vasooli → Box $boxN · ${e.name}', false, DateTime.now()));
    }
    _syncLocked();
    notifyListeners();
    _dirty();
    return true;
  }

  void markReminded(KhataEntry e) {
    e.reminderCount += 1;
    e.lastReminderAt = DateTime.now();
    e.updatedAt = DateTime.now();
    notifyListeners();
    _dirty();
  }

  void openBaatFor(KhataEntry e) {
    baatEntryId = e.id;
    requestedTab = 2;
    notifyListeners();
  }

  void updateSettings(void Function(AppSettings s) edit) {
    edit(settings);
    notifyListeners();
    _dirty();
  }

  // ------------------------------------------------------------------ import / export
  /// Accepts: BaatBanao backup JSON ({app:'BaatBanao', data:{bb_khata:[...]}}), a raw bb_khata array,
  /// or this app's own export. Returns the number of khata entries imported (merged by id).
  int importJson(String text) {
    final parsed = jsonDecode(text);
    List<KhataEntry> incoming = [];
    if (parsed is List) {
      incoming = parseKhataList(parsed);
    } else if (parsed is Map) {
      final m = Map<String, dynamic>.from(parsed);
      if (m['data'] is Map) {
        final d = Map<String, dynamic>.from(m['data'] as Map);
        if (d['bb_khata'] is List) incoming = parseKhataList(d['bb_khata']);
        if (d['bb_settings'] is Map) {
          final s = AppSettings.fromJson(Map<String, dynamic>.from(d['bb_settings'] as Map));
          settings.defaultLanguage = s.defaultLanguage;
          settings.defaultTone = s.defaultTone;
          settings.upiId = s.upiId;
          settings.soundEnabled = s.soundEnabled;
          settings.hapticsEnabled = s.hapticsEnabled;
          settings.reduceMotion = s.reduceMotion;
          settings.lowBalanceAlerts = s.lowBalanceAlerts;
          settings.overdueAlerts = s.overdueAlerts;
          world.hapticsEnabled = settings.hapticsEnabled;
          world.soundEnabled = settings.soundEnabled;
          world.reduceMotion = settings.reduceMotion;
          world.lowBalanceAlerts = settings.lowBalanceAlerts;
          world.overdueAlerts = settings.overdueAlerts;
        }
      } else if (m['khata'] is List) {
        incoming = parseKhataList(m['khata']);
      } else if (m['bb_khata'] is List) {
        incoming = parseKhataList(m['bb_khata']);
      }
    }
    var n = 0;
    for (final e in incoming) {
      final i = khata.indexWhere((k) => k.id == e.id);
      if (i >= 0) {
        khata[i] = e;
      } else {
        khata.add(e);
      }
      n++;
    }
    _syncLocked(animate: false);
    notifyListeners();
    _dirty();
    return n;
  }

  String exportJson() => const JsonEncoder.withIndent('  ').convert({
        'app': 'BaatBanao',
        'version': 1,
        'exportedAt': DateTime.now().toIso8601String(),
        'data': {
          'bb_khata': khata.map((k) => k.toJson()).toList(),
          'bb_settings': settings.toJson(),
          storageKey: toJson(),
        },
      });

  Future<void> resetAll() async {
    await _prefs.remove(storageKey);
  }
}

List<KhataEntry> parseKhataList(dynamic list) {
  if (list is! List) return [];
  final out = <KhataEntry>[];
  for (final e in list) {
    if (e is Map) {
      try {
        out.add(KhataEntry.fromJson(Map<String, dynamic>.from(e)));
      } catch (_) {}
    }
  }
  return out;
}

List<KhataEntry> seedKhata() {
  final today = DateTime.now();
  String iso(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  return [
    KhataEntry(id: 'seed-1', name: 'Ramesh', phone: '', amount: 300, dueDate: iso(today.add(const Duration(days: 3))), relation: 'Shop Khata', tone: 'Polite'),
  ];
}
