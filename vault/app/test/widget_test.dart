import 'package:flutter_test/flutter_test.dart';
import 'package:paanikhata_icecubes/main.dart';

void main() {
  testWidgets('home renders 8 boxes header', (tester) async {
    await tester.pumpWidget(const PaaniKhataApp());
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.textContaining('8 boxes'), findsOneWidget);
  });
}
