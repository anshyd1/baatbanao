// App shell: boots the Store, then shows the three tabs — Vault · Khata · Baat.
import 'package:flutter/material.dart';

import 'baat.dart';
import 'khata.dart';
import 'main.dart' show HomeScreen;
import 'store.dart';

class BootScreen extends StatefulWidget {
  const BootScreen({super.key});
  @override
  State<BootScreen> createState() => _BootScreenState();
}

class _BootScreenState extends State<BootScreen> {
  late final Future<Store> _future = Store.load();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Store>(
      future: _future,
      builder: (context, snap) {
        if (snap.hasError) {
          return Scaffold(body: Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('Data load nahi hua:\n${snap.error}', textAlign: TextAlign.center))));
        }
        if (!snap.hasData) {
          return const Scaffold(
            body: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Text('BaatBanao Vault', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF14181E))),
                SizedBox(height: 6),
                Text('Every rupee, in its place.', style: TextStyle(color: Color(0xFF5A6473))),
                SizedBox(height: 18),
                SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5)),
              ]),
            ),
          );
        }
        return ShellScreen(store: snap.data!);
      },
    );
  }
}

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key, required this.store});
  final Store store;
  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int index = 0;
  Store get store => widget.store;

  @override
  void initState() {
    super.initState();
    store.addListener(_onStore);
    if (store.lastImportInfo.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${store.lastImportInfo} ✓')));
        store.lastImportInfo = '';
      });
    }
  }

  void _onStore() {
    final t = store.requestedTab;
    if (t != null) {
      store.requestedTab = null;
      if (mounted) setState(() => index = t);
    } else if (mounted) {
      setState(() {});
    }
  }

  @override
  void dispose() {
    store.removeListener(_onStore);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final overdue = store.settings.overdueAlerts ? store.overdueCount : 0;
    final pending = store.pendingCount;
    return Scaffold(
      body: IndexedStack(
        index: index,
        children: [
          HomeScreen(world: store.world),
          KhataScreen(store: store),
          BaatScreen(store: store),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: [
          const NavigationDestination(icon: Icon(Icons.water_drop_outlined), selectedIcon: Icon(Icons.water_drop_rounded), label: 'Vault'),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: pending > 0,
              backgroundColor: overdue > 0 ? const Color(0xFFD9534F) : const Color(0xFFFF8C28),
              label: Text('${overdue > 0 ? overdue : pending}'),
              child: const Icon(Icons.receipt_long_outlined),
            ),
            selectedIcon: const Icon(Icons.receipt_long_rounded),
            label: 'Khata',
          ),
          const NavigationDestination(icon: Icon(Icons.chat_bubble_outline_rounded), selectedIcon: Icon(Icons.chat_bubble_rounded), label: 'Baat'),
        ],
      ),
    );
  }
}
