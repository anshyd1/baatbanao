import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:paanikhata_icecubes/baat.dart';
import 'package:paanikhata_icecubes/khata_model.dart';
import 'package:paanikhata_icecubes/store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('first run: Locked Box = pending khata sum; collect thaws into a box; state persists', () async {
    SharedPreferences.setMockInitialValues({});
    final s = await Store.load();
    final lb = s.world.lockedBody!;
    expect(lb.acc.locked, isTrue);
    expect(lb.acc.balance, s.pendingTotal); // seed Ramesh 300
    expect(s.pendingTotal, 300);

    final cash = s.world.byN(3);
    final before = cash.acc.balance;
    final e = s.khata.first;
    expect(s.collect(e, 100, 3), isTrue);
    expect(cash.acc.balance, before + 100);
    expect(e.status, 'partial');
    expect(lb.acc.balance, 200);

    expect(s.collect(e, 200, 3), isTrue);
    expect(e.isPaid, isTrue);
    expect(lb.acc.balance, 0);

    // direct edits to the locked box are refused
    expect(s.world.apply(lb.acc.n, 50, true, 'x'), isFalse);

    await s.save();
    final s2 = await Store.load();
    expect(s2.world.byN(3).acc.balance, before + 300);
    expect(s2.khata.first.isPaid, isTrue);
    expect(s2.world.lockedBody!.acc.balance, 0);
  });

  test('imports the PWA backup format (string amounts, epoch timestamps)', () async {
    SharedPreferences.setMockInitialValues({});
    final s = await Store.load();
    final backup = jsonEncode({
      'app': 'BaatBanao',
      'version': 1,
      'data': {
        'bb_khata': [
          {'id': 'a1', 'name': 'Suresh', 'phone': '9876543210', 'amount': '1,200', 'paidAmount': '200', 'dueDate': '2026-10-05', 'status': 'partial', 'language': 'Bhojpuri', 'tone': 'polite', 'createdAt': 1758000000000},
          {'id': 'a2', 'name': 'Mohan', 'amount': 500, 'status': 'paid', 'paidAmount': 500},
        ],
        'bb_settings': {'defaultLanguage': 'Hindi', 'defaultTone': 'Firm'},
      },
    });
    expect(s.importJson(backup), 2);
    final suresh = s.byId('a1')!;
    expect(suresh.outstanding, 1000);
    expect(suresh.language, 'Bhojpuri');
    expect(suresh.tone, 'Polite');
    expect(s.pendingTotal, 300 + 1000);
    expect(s.world.lockedBody!.acc.balance, 1300);
    expect(s.settings.defaultLanguage, 'Hindi');
    // export round-trips
    final again = s.importJson(s.exportJson());
    expect(again, 3);
  });

  test('templates render for every tone × language and wa.me links get the 91 prefix', () {
    for (final t in kTones) {
      for (final l in kLanguages) {
        final m = buildMessages(name: 'Ramesh', amount: 1500, language: l, tone: t, note: 'dukaan');
        expect(m.length, 3);
        for (final x in m) {
          expect(x.contains('Ramesh'), isTrue);
          expect(x.contains('₹1,500'), isTrue);
          expect(x.contains('{'), isFalse);
        }
      }
    }
    expect(whatsappUri('98765 43210', 'hi').toString(), startsWith('https://wa.me/919876543210?text='));
    expect(whatsappUri('', 'hi').toString(), startsWith('https://wa.me/?text='));
    expect(KhataEntry.parseNum('₹2,50,000'), 250000);
  });
}
