// Khata: receivables ledger. Every pending rupee here is what fills the Locked Box in the Vault.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'baat.dart' show kLanguages, kTones;
import 'khata_model.dart';
import 'main.dart' show inr;
import 'store.dart';

const kRelations = ['General', 'Dost', 'Client', 'Shop Khata'];

String fmtDue(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return '${d.day} ${m[d.month - 1]}';
}

class KhataScreen extends StatefulWidget {
  const KhataScreen({super.key, required this.store});
  final Store store;
  @override
  State<KhataScreen> createState() => _KhataScreenState();
}

class _KhataScreenState extends State<KhataScreen> {
  Store get store => widget.store;

  @override
  void initState() {
    super.initState();
    store.addListener(_refresh);
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    store.removeListener(_refresh);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = store.sortedKhata;
    final lockedN = store.world.lockedBody?.acc.n;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Khata'),
        centerTitle: false,
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'import') _importSheet(context);
              if (v == 'export') _export(context);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'import', child: ListTile(leading: Icon(Icons.download_rounded), title: Text('Import backup (JSON)'), contentPadding: EdgeInsets.zero)),
              PopupMenuItem(value: 'export', child: ListTile(leading: Icon(Icons.upload_rounded), title: Text('Export / copy backup'), contentPadding: EdgeInsets.zero)),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showEntrySheet(context, store, null),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Credit Entry'),
      ),
      body: Column(
        children: [
          _Summary(store: store, lockedN: lockedN),
          Expanded(
            child: list.isEmpty
                ? const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No active credit records.\nTap "+ Add Credit Entry" to record receivables. Pending amounts reflect in your Locked Vault box.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF5A6473)))))
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 96),
                    itemCount: list.length,
                    itemBuilder: (_, i) => _EntryTile(e: list[i], onTap: () => _actions(context, list[i])),
                  ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------- actions
  void _actions(BuildContext context, KhataEntry e) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            title: Text(e.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            subtitle: Text('${inr(e.outstanding)} baaki of ${inr(e.amount)}${e.dueDate.isNotEmpty ? ' · due ${fmtDue(e.dueDate)}' : ''}'),
          ),
          if (!e.isPaid) ...[
            ListTile(
              leading: const Icon(Icons.chat_rounded, color: Color(0xFF25D366)),
              title: const Text('Yaad dilao (Baat)'),
              onTap: () {
                Navigator.pop(ctx);
                store.openBaatFor(e);
              },
            ),
            ListTile(
              leading: const Icon(Icons.check_circle_rounded, color: Color(0xFF20B296)),
              title: Text('Pura aa gaya · ${inr(e.outstanding)}'),
              subtitle: const Text('Locked Box se nikal ke kisi box me daalo'),
              onTap: () {
                Navigator.pop(ctx);
                _collect(context, e, e.outstanding);
              },
            ),
            ListTile(
              leading: const Icon(Icons.pie_chart_rounded, color: Color(0xFF3478F6)),
              title: const Text('Partial Payment Received'),
              onTap: () {
                Navigator.pop(ctx);
                _partial(context, e);
              },
            ),
          ],
          ListTile(
            leading: const Icon(Icons.edit_rounded),
            title: const Text('Edit'),
            onTap: () {
              Navigator.pop(ctx);
              showEntrySheet(context, store, e);
            },
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline_rounded, color: Color(0xFFD9534F)),
            title: const Text('Delete'),
            onTap: () async {
              Navigator.pop(ctx);
              final confirm = await showDialog<bool>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  title: Text('Delete ${e.name}’s entry?'),
                  content: const Text('This removes the Khata entry and adjusts the locked balance. This action cannot be undone.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancel')),
                    FilledButton.tonal(
                      style: FilledButton.styleFrom(foregroundColor: const Color(0xFFD9534F)),
                      onPressed: () => Navigator.pop(dialogContext, true),
                      child: const Text('Delete'),
                    ),
                  ],
                ),
              );
              if (confirm != true || !context.mounted) return;
              store.remove(e.id);
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${e.name}’s entry deleted')));
            },
          ),
          const SizedBox(height: 8),
          ]),
        ),
      ),
    );
  }

  Future<void> _partial(BuildContext context, KhataEntry e) async {
    final c = TextEditingController();
    final v = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Payment from ${e.name} — Amount?'),
        content: TextField(
          controller: c,
          autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(prefixText: '₹ ', helperText: 'Remaining: ${inr(e.outstanding)}'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, double.tryParse(c.text.replaceAll(',', ''))), child: const Text('Next')),
        ],
      ),
    );
    if (v == null || v <= 0 || !context.mounted) return;
    _collect(context, e, v > e.outstanding ? e.outstanding : v);
  }

  Future<void> _collect(BuildContext context, KhataEntry e, double amt) async {
    final boxes = store.world.bodies.where((b) => !b.acc.locked).toList()..sort((a, b) => a.acc.n.compareTo(b.acc.n));
    final n = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
            child: Column(children: [
              Text('${inr(amt)} received — deposit to which box?', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('${e.name} · Funds will unlock from ledger and pour into this account', style: const TextStyle(color: Color(0xFF5A6473), fontSize: 12)),
            ]),
          ),
          Flexible(
            child: ListView(
              shrinkWrap: true,
              children: [
                for (final b in boxes)
                  ListTile(
                    leading: Container(width: 34, height: 34, decoration: BoxDecoration(color: b.acc.color, borderRadius: BorderRadius.circular(9)), alignment: Alignment.center, child: Text('${b.acc.n}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
                    title: Text(b.acc.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                    trailing: Text(inr(b.acc.balance), style: const TextStyle(color: Color(0xFF5A6473))),
                    onTap: () => Navigator.pop(ctx, b.acc.n),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ]),
      ),
    );
    if (n == null || !context.mounted) return;
    final ok = store.collect(e, amt, n);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok ? '${inr(amt)} → Box $n · ${store.world.byN(n).acc.name}  ✓  (${e.isPaid ? '${e.name} settled' : 'baaki ${inr(e.outstanding)}'})' : 'Nahi hua — box locked hai'),
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ---------------------------------------------------------------- import / export
  Future<void> _importSheet(BuildContext context) async {
    final c = TextEditingController();
    final txt = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Import backup'),
        content: SizedBox(
          width: 420,
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('BaatBanao PWA → Backup → Export se mila JSON yahan paste karo (ya bb_khata array).', style: TextStyle(fontSize: 13, color: Color(0xFF5A6473))),
            const SizedBox(height: 10),
            TextField(controller: c, maxLines: 8, minLines: 4, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '{ "app": "BaatBanao", ... }')),
          ]),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              final d = await Clipboard.getData('text/plain');
              c.text = d?.text ?? '';
            },
            child: const Text('Paste from clipboard'),
          ),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text), child: const Text('Import')),
        ],
      ),
    );
    if (txt == null || txt.trim().isEmpty || !context.mounted) return;
    try {
      final n = store.importJson(txt);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$n entries import hui ✓')));
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('JSON samajh nahi aaya — pura backup text paste karo')));
    }
  }

  Future<void> _export(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: store.exportJson()));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Backup JSON clipboard me copy ho gaya — kahin bhi save kar lo')));
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.store, required this.lockedN});
  final Store store;
  final int? lockedN;
  @override
  Widget build(BuildContext context) {
    final total = store.pendingTotal;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF2E3A48), Color(0xFF4B5766)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lockedN == null ? 'Pending' : 'Locked Box · Box $lockedN', style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
            const SizedBox(height: 2),
            Text(inr(total), style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800)),
            Text('${store.pendingCount} log · ${store.overdueCount} overdue', style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ]),
        ),
        const Icon(Icons.lock_rounded, color: Colors.white54, size: 40),
      ]),
    );
  }
}

class _EntryTile extends StatelessWidget {
  const _EntryTile({required this.e, required this.onTap});
  final KhataEntry e;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final Color c = e.isPaid
        ? const Color(0xFF20B296)
        : e.isOverdue
            ? const Color(0xFFD9534F)
            : e.status == 'partial'
                ? const Color(0xFF3478F6)
                : const Color(0xFFFF8C28);
    final status = e.isPaid
        ? 'Paid'
        : e.isOverdue
            ? 'Overdue'
            : e.status == 'partial'
                ? 'Partial'
                : 'Pending';
    return Card(
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFFE1E6EE))),
      color: Colors.white,
      child: ListTile(
        onTap: onTap,
        leading: CircleAvatar(backgroundColor: c.withAlpha(30), child: Text(e.name.isEmpty ? '?' : e.name[0].toUpperCase(), style: TextStyle(color: c, fontWeight: FontWeight.w800))),
        title: Text(e.name, style: TextStyle(fontWeight: FontWeight.w800, decoration: e.isPaid ? TextDecoration.lineThrough : null)),
        subtitle: Text(
          [
            if (!e.isPaid) '${inr(e.outstanding)} baaki' else 'settled ${inr(e.amount)}',
            if (e.paidAmount > 0 && !e.isPaid) 'of ${inr(e.amount)}',
            if (e.dueDate.isNotEmpty) 'due ${fmtDue(e.dueDate)}',
            if (e.relation != 'General') e.relation,
            if (e.reminderCount > 0) '${e.reminderCount}× reminded',
          ].join(' · '),
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: c.withAlpha(28), borderRadius: BorderRadius.circular(20)),
          child: Text(status, style: TextStyle(color: c, fontWeight: FontWeight.w800, fontSize: 11)),
        ),
      ),
    );
  }
}

/// Add / edit sheet.
Future<void> showEntrySheet(BuildContext context, Store store, KhataEntry? existing) async {
  final nameC = TextEditingController(text: existing?.name ?? '');
  final phoneC = TextEditingController(text: existing?.phone ?? '');
  final amtC = TextEditingController(text: existing == null ? '' : existing.amount.toStringAsFixed(existing.amount % 1 == 0 ? 0 : 2));
  final noteC = TextEditingController(text: existing?.note ?? '');
  var due = existing?.dueDate ?? '';
  var relation = existing?.relation ?? 'General';
  var language = existing?.language ?? store.settings.defaultLanguage;
  var tone = existing?.tone ?? store.settings.defaultTone;

  await showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setS) => Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(existing == null ? 'Naya udhaar' : 'Edit · ${existing.name}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            TextField(controller: nameC, autofocus: existing == null, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Naam', border: OutlineInputBorder(), isDense: true)),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: amtC, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Amount', prefixText: '₹ ', border: OutlineInputBorder(), isDense: true))),
              const SizedBox(width: 8),
              Expanded(child: TextField(controller: phoneC, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'WhatsApp no.', border: OutlineInputBorder(), isDense: true))),
            ]),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () async {
                final now = DateTime.now();
                final init = DateTime.tryParse(due) ?? now.add(const Duration(days: 7));
                final d = await showDatePicker(context: ctx, initialDate: init.isBefore(now) ? now : init, firstDate: now.subtract(const Duration(days: 365)), lastDate: now.add(const Duration(days: 365 * 3)));
                if (d != null) setS(() => due = '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
              },
              icon: const Icon(Icons.event_rounded),
              label: Text(due.isEmpty ? 'Due date (optional)' : 'Due ${fmtDue(due)}'),
            ),
            const SizedBox(height: 10),
            const Text('Rishta', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF5A6473))),
            Wrap(spacing: 6, children: [for (final r in kRelations) ChoiceChip(label: Text(r), selected: relation == r, showCheckmark: false, onSelected: (_) => setS(() => relation = r))]),
            const SizedBox(height: 6),
            const Text('Reminder bhasha · tone', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF5A6473))),
            Wrap(spacing: 6, children: [for (final l in kLanguages) ChoiceChip(label: Text(l), selected: language == l, showCheckmark: false, onSelected: (_) => setS(() => language = l))]),
            Wrap(spacing: 6, children: [for (final t in kTones) ChoiceChip(label: Text(t), selected: tone == t, showCheckmark: false, onSelected: (_) => setS(() => tone = t))]),
            const SizedBox(height: 10),
            TextField(controller: noteC, decoration: const InputDecoration(labelText: 'Note (kis cheez ka)', border: OutlineInputBorder(), isDense: true)),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  final amt = double.tryParse(amtC.text.replaceAll(',', '')) ?? 0;
                  if (nameC.text.trim().isEmpty || amt <= 0) {
                    ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(content: Text('Naam aur amount zaroori hai')));
                    return;
                  }
                  final e = existing ?? KhataEntry(id: 'k${DateTime.now().millisecondsSinceEpoch}', name: '');
                  e
                    ..name = nameC.text.trim()
                    ..phone = phoneC.text.trim()
                    ..amount = amt
                    ..dueDate = due
                    ..relation = relation
                    ..language = language
                    ..tone = tone
                    ..note = noteC.text.trim();
                  if (e.paidAmount > e.amount) e.paidAmount = e.amount;
                  store.upsert(e);
                  Navigator.pop(ctx);
                },
                child: Text(existing == null ? 'Khata me likho' : 'Save'),
              ),
            ),
          ]),
        ),
      ),
    ),
  );
}
