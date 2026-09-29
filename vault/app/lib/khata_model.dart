// Khata (receivables ledger) model — compatible with the BaatBanao PWA `bb_khata` records.

class KhataEntry {
  KhataEntry({
    required this.id,
    required this.name,
    this.phone = '',
    this.amount = 0,
    this.paidAmount = 0,
    this.dueDate = '',
    this.relation = 'General',
    this.status = 'pending',
    this.language = 'Hinglish',
    this.tone = 'Friendly',
    this.note = '',
    this.reminderCount = 0,
    this.lastReminderAt,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  final String id;
  String name;
  String phone;
  double amount;
  double paidAmount;
  String dueDate; // YYYY-MM-DD or ''
  String relation;
  String status; // pending | partial | paid
  String language; // Hinglish | Hindi | Bhojpuri | English
  String tone; // Friendly | Polite | Firm
  String note;
  int reminderCount;
  DateTime? lastReminderAt;
  DateTime createdAt;
  DateTime updatedAt;

  double get outstanding {
    final v = amount - paidAmount;
    return v < 0 ? 0 : v;
  }

  bool get isPaid => status == 'paid' || (amount > 0 && outstanding <= 0);

  DateTime? get due => dueDate.isEmpty ? null : DateTime.tryParse(dueDate);

  bool get isOverdue {
    if (isPaid) return false;
    final d = due;
    if (d == null) return false;
    final t = DateTime.now();
    return d.isBefore(DateTime(t.year, t.month, t.day));
  }

  void recomputeStatus() {
    if (amount > 0 && outstanding <= 0) {
      status = 'paid';
    } else if (paidAmount > 0) {
      status = 'partial';
    } else if (status != 'paid') {
      status = 'pending';
    }
  }

  static double parseNum(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString().replaceAll(RegExp(r'[^0-9.\-]'), '')) ?? 0;
  }

  static DateTime? parseTs(dynamic v) {
    if (v == null) return null;
    if (v is num) return DateTime.fromMillisecondsSinceEpoch(v.toInt());
    return DateTime.tryParse(v.toString());
  }

  static String normalizeTone(dynamic v) {
    final t = (v ?? '').toString().toLowerCase();
    if (t.contains('polite')) return 'Polite';
    if (t.contains('firm') || t.contains('strict') || t.contains('serious')) return 'Firm';
    return 'Friendly';
  }

  static String normalizeLang(dynamic v) {
    final t = (v ?? '').toString().toLowerCase();
    if (t.startsWith('hindi')) return 'Hindi';
    if (t.startsWith('bhoj')) return 'Bhojpuri';
    if (t.startsWith('eng')) return 'English';
    return 'Hinglish';
  }

  factory KhataEntry.fromJson(Map<String, dynamic> j) => KhataEntry(
        id: (j['id'] ?? DateTime.now().microsecondsSinceEpoch).toString(),
        name: (j['name'] ?? 'Bhai').toString(),
        phone: (j['phone'] ?? '').toString(),
        amount: parseNum(j['amount']),
        paidAmount: parseNum(j['paidAmount']),
        dueDate: (j['dueDate'] ?? '').toString(),
        relation: (j['relation'] ?? 'General').toString(),
        status: (j['status'] ?? 'pending').toString(),
        language: normalizeLang(j['language']),
        tone: normalizeTone(j['tone']),
        note: (j['note'] ?? '').toString(),
        reminderCount: j['reminderCount'] is num ? (j['reminderCount'] as num).toInt() : 0,
        lastReminderAt: parseTs(j['lastReminderAt']),
        createdAt: parseTs(j['createdAt']),
        updatedAt: parseTs(j['updatedAt']),
      )..recomputeStatus();

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'amount': amount,
        'paidAmount': paidAmount,
        'dueDate': dueDate,
        'relation': relation,
        'status': status,
        'language': language,
        'tone': tone,
        'note': note,
        'reminderCount': reminderCount,
        'lastReminderAt': lastReminderAt?.millisecondsSinceEpoch,
        'createdAt': createdAt.millisecondsSinceEpoch,
        'updatedAt': updatedAt.millisecondsSinceEpoch,
      };
}

class AppSettings {
  AppSettings({
    this.defaultLanguage = 'Hinglish',
    this.defaultTone = 'Friendly',
    this.upiId = '',
    this.soundEnabled = false,
    this.hapticsEnabled = true,
    this.reduceMotion = false,
    this.lowBalanceAlerts = true,
    this.overdueAlerts = true,
  });
  String defaultLanguage;
  String defaultTone;
  String upiId;
  bool soundEnabled;
  bool hapticsEnabled;
  bool reduceMotion;
  bool lowBalanceAlerts;
  bool overdueAlerts;

  factory AppSettings.fromJson(Map<String, dynamic> j) => AppSettings(
        defaultLanguage: KhataEntry.normalizeLang(j['defaultLanguage']),
        defaultTone: KhataEntry.normalizeTone(j['defaultTone']),
        upiId: (j['upiId'] ?? '').toString(),
        soundEnabled: j['soundEnabled'] == true,
        hapticsEnabled: j['hapticsEnabled'] != false,
        reduceMotion: j['reduceMotion'] == true,
        lowBalanceAlerts: j['lowBalanceAlerts'] != false,
        overdueAlerts: j['overdueAlerts'] != false,
      );

  Map<String, dynamic> toJson() => {
        'defaultLanguage': defaultLanguage,
        'defaultTone': defaultTone,
        'upiId': upiId,
        'soundEnabled': soundEnabled,
        'hapticsEnabled': hapticsEnabled,
        'reduceMotion': reduceMotion,
        'lowBalanceAlerts': lowBalanceAlerts,
        'overdueAlerts': overdueAlerts,
      };
}
