import 'package:flutter_test/flutter_test.dart';
import 'package:paanikhata_icecubes/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('shell boots with three tabs and the vault header', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(const PaaniKhataApp());
    // Store.load() is async: pump a few frames (never pumpAndSettle — the vault ticker runs forever).
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('Vault'), findsWidgets);
    expect(find.text('Khata'), findsWidgets);
    expect(find.text('Baat'), findsWidgets);
    expect(find.textContaining('8 boxes'), findsOneWidget);
  });
}
