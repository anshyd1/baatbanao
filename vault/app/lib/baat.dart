// Baat: payment reminder composer (4 languages × 3 tones) with Copy / WhatsApp send.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'khata_model.dart';
import 'main.dart' show inr;
import 'store.dart';

const kLanguages = ['Hinglish', 'Hindi', 'Bhojpuri', 'English'];
const kTones = ['Friendly', 'Polite', 'Firm'];

/// tone -> language -> templates. Placeholders: {n} name, {a} amount.
const Map<String, Map<String, List<String>>> kTemplates = {
  'Friendly': {
    'Hinglish': [
      'Hey {n}! 👋 Yaad hai na, {a} abhi baaki hai? Jab free ho bhej dena 😊',
      '{n} bhai, chhota sa reminder — {a} pending hai. Dosti apni jagah, hisaab apni jagah 😄',
      'Arre {n}, {a} ka hisaab clear kar do yaar, phir chai meri taraf se ☕',
    ],
    'Hindi': [
      'नमस्ते {n} जी! याद दिला रहे हैं, {a} अभी बाकी है। समय मिलते ही भेज दीजिए 🙏',
      '{n} भाई, छोटा सा रिमाइंडर — {a} पेंडिंग है। दोस्ती अपनी जगह, हिसाब अपनी जगह 😄',
      '{n} जी, {a} का हिसाब आज क्लियर कर दें तो बढ़िया रहेगा 😊',
    ],
    'Bhojpuri': [
      'का हाल बा {n} भइया! {a} अभी बाकी बा, फुरसत मिलते भेज दीहीं 😊',
      '{n} भाई, तनी याद करा दीं — {a} पेंडिंग बा। आज भेज दीं त बढ़िया रही 🙏',
      'अरे {n}, {a} के हिसाब आजे बराबर कर दीं, फेर चाय हमरा तरफ से ☕',
    ],
    'English': [
      "Hey {n}! 👋 Quick reminder — {a} is still pending. Send it whenever you're free 😊",
      'Hi {n}, friendly nudge: {a} is due. Would love to close this today!',
      "{n}, just checking in on the {a} — let me know once it's sent. Thanks!",
    ],
  },
  'Polite': {
    'Hinglish': [
      'Namaste {n} ji 🙏 {a} ka payment abhi pending hai. Kripya aaj bhej dijiye, dhanyavaad.',
      '{n} ji, aapko yaad dilana chahte hain ki {a} baaki hai. Suvidha anusaar jaldi bhej dijiyega 🙏',
      'Hello {n}, {a} ka hisaab abhi tak clear nahi hua. Aaj kar dijiye toh badi meherbani hogi.',
    ],
    'Hindi': [
      'नमस्ते {n} जी 🙏 {a} का भुगतान अभी बाकी है। कृपया आज भेज दीजिए, धन्यवाद।',
      '{n} जी, विनम्र निवेदन है कि {a} की राशि जल्द भेज दें। आभार 🙏',
      '{n} जी, {a} का हिसाब अभी शेष है। सुविधा अनुसार आज भुगतान कर दीजिए।',
    ],
    'Bhojpuri': [
      'परनाम {n} जी 🙏 {a} के भुगतान अभी बाकी बा। किरपा करके आज भेज दीं।',
      '{n} जी, निहोरा बा — {a} के रकम जल्दी भेज दीं। धन्यवाद 🙏',
      '{n} जी, {a} के हिसाब अभी बाकी बा, आज कर दीं त बड़ा किरपा होई।',
    ],
    'English': [
      'Hi {n}, gentle reminder — {a} is still pending. Please send today 🙏',
      'Dear {n}, this is a courteous reminder that {a} remains due. Kindly settle at your earliest convenience.',
      'Hello {n}, could you please clear the pending {a} today? Thank you for your cooperation.',
    ],
  },
  'Firm': {
    'Hinglish': [
      '{n}, {a} ka payment kaafi time se pending hai. Aaj clear kar dijiye — aage wait nahi ho payega.',
      'Reminder: {n}, {a} abhi tak nahi aaya. Aaj shaam tak bhej dijiye, please.',
      '{n}, hisaab {a} ka hai aur due date nikal chuki hai. Aaj hi payment kijiye.',
    ],
    'Hindi': [
      '{n} जी, {a} का भुगतान काफी समय से लंबित है। कृपया आज ही क्लियर करें।',
      'रिमाइंडर: {n}, {a} अभी तक प्राप्त नहीं हुआ। आज शाम तक भेजें।',
      '{n}, {a} की देय तिथि निकल चुकी है। कृपया आज ही भुगतान करें।',
    ],
    'Bhojpuri': [
      '{n}, {a} के भुगतान बहुत दिन से बाकी बा। आजे क्लियर कर दीं।',
      'रिमाइंडर: {n}, {a} अभी ले ना आइल। आज सांझ ले भेज दीं।',
      '{n}, {a} के तारीख निकल गइल बा। आजे पइसा भेजीं।',
    ],
    'English': [
      '{n}, the payment of {a} has been pending for a while. Please clear it today.',
      'Reminder: {n}, {a} is overdue. Kindly send it by this evening.',
      '{n}, the due date for {a} has passed. Please make the payment today to avoid further follow-ups.',
    ],
  },
};

List<String> buildMessages({
  required String name,
  required double amount,
  required String language,
  required String tone,
  String note = '',
  String upiId = '',
}) {
  final lang = kTemplates[tone]?[language] ?? kTemplates['Friendly']!['Hinglish']!;
  final n = name.trim().isEmpty ? 'Bhai' : name.trim();
  final a = inr(amount);
  return lang.map((t) {
    var m = t.replaceAll('{n}', n).replaceAll('{a}', a);
    if (note.trim().isNotEmpty) m += '\n(${note.trim()})';
    if (upiId.trim().isNotEmpty) m += '\nUPI: ${upiId.trim()}';
    return m;
  }).toList();
}

/// wa.me link. Indian 10-digit numbers get the 91 prefix automatically.
Uri whatsappUri(String phone, String text) {
  var digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.length == 10) digits = '91$digits';
  if (digits.startsWith('0') && digits.length == 11) digits = '91${digits.substring(1)}';
  final q = Uri.encodeComponent(text);
  return Uri.parse(digits.isEmpty ? 'https://wa.me/?text=$q' : 'https://wa.me/$digits?text=$q');
}

class BaatScreen extends StatefulWidget {
  const BaatScreen({super.key, required this.store});
  final Store store;
  @override
  State<BaatScreen> createState() => _BaatScreenState();
}

class _BaatScreenState extends State<BaatScreen> {
  Store get store => widget.store;
  String? selectedId; // null = manual
  final nameC = TextEditingController();
  final amtC = TextEditingController();
  final phoneC = TextEditingController();
  late String language = store.settings.defaultLanguage;
  late String tone = store.settings.defaultTone;

  @override
  void initState() {
    super.initState();
    store.addListener(_onStore);
    _pickFromStore();
  }

  void _onStore() {
    if (store.baatEntryId != null && store.baatEntryId != selectedId) {
      _pickFromStore();
    }
    if (mounted) setState(() {});
  }

  void _pickFromStore() {
    final e = store.byId(store.baatEntryId);
    if (e != null) {
      selectedId = e.id;
      language = e.language;
      tone = e.tone;
    } else {
      final pending = store.sortedKhata.where((k) => !k.isPaid).toList();
      selectedId = pending.isEmpty ? null : pending.first.id;
    }
    store.baatEntryId = null;
  }

  @override
  void dispose() {
    store.removeListener(_onStore);
    nameC.dispose();
    amtC.dispose();
    phoneC.dispose();
    super.dispose();
  }

  KhataEntry? get entry => store.byId(selectedId);

  String get _name => entry?.name ?? nameC.text;
  double get _amount => entry?.outstanding ?? (double.tryParse(amtC.text.replaceAll(',', '')) ?? 0);
  String get _phone => entry?.phone ?? phoneC.text;
  String get _note => entry?.note ?? '';

  Future<void> _copy(String m) async {
    await Clipboard.setData(ClipboardData(text: m));
    if (entry != null) store.markReminded(entry!);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Message copy ho gaya ✓')));
  }

  Future<void> _whatsapp(String m) async {
    final uri = whatsappUri(_phone, m);
    var ok = false;
    try {
      ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
    if (!mounted) return;
    if (ok) {
      if (entry != null) store.markReminded(entry!);
    } else {
      await Clipboard.setData(ClipboardData(text: m));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('WhatsApp nahi khula — message copy kar diya, paste kar do')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = store.sortedKhata.where((k) => !k.isPaid).toList();
    final msgs = buildMessages(name: _name, amount: _amount, language: language, tone: tone, note: _note, upiId: store.settings.upiId);
    final e = entry;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Baat'),
        centerTitle: false,
        actions: [
          IconButton(
            tooltip: 'UPI ID',
            icon: const Icon(Icons.qr_code_2_rounded),
            onPressed: () => _editUpi(context),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
        children: [
          const _Label('Kisko yaad dilana hai?'),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _chip('✍️ Manual', selectedId == null, () => setState(() => selectedId = null)),
                for (final k in pending)
                  _chip('${k.name} · ${inr(k.outstanding)}', selectedId == k.id, () => setState(() {
                        selectedId = k.id;
                        language = k.language;
                        tone = k.tone;
                      })),
              ],
            ),
          ),
          if (e == null) ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(flex: 3, child: TextField(controller: nameC, decoration: const InputDecoration(labelText: 'Naam', isDense: true, border: OutlineInputBorder()), onChanged: (_) => setState(() {}))),
              const SizedBox(width: 8),
              Expanded(flex: 2, child: TextField(controller: amtC, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: '₹ Amount', isDense: true, border: OutlineInputBorder()), onChanged: (_) => setState(() {}))),
            ]),
            const SizedBox(height: 8),
            TextField(controller: phoneC, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'WhatsApp number (optional)', isDense: true, border: OutlineInputBorder()), onChanged: (_) => setState(() {})),
          ] else ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFE1E6EE))),
              child: Row(children: [
                CircleAvatar(backgroundColor: const Color(0xFFFFF1E0), child: Text(e.name.isEmpty ? '?' : e.name[0].toUpperCase(), style: const TextStyle(color: Color(0xFFB45A00), fontWeight: FontWeight.w800))),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(e.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                    Text('${inr(e.outstanding)} baaki${e.phone.isNotEmpty ? ' · ${e.phone}' : ' · number nahi'}${e.reminderCount > 0 ? ' · ${e.reminderCount} reminders' : ''}',
                        style: const TextStyle(color: Color(0xFF5A6473), fontSize: 12)),
                  ]),
                ),
                if (e.isOverdue) const Chip(label: Text('Overdue'), visualDensity: VisualDensity.compact, backgroundColor: Color(0xFFFFE4E1), side: BorderSide.none),
              ]),
            ),
          ],
          const SizedBox(height: 14),
          const _Label('Bhasha'),
          Wrap(spacing: 8, children: [for (final l in kLanguages) _chip(l, language == l, () => _setLang(l))]),
          const SizedBox(height: 10),
          const _Label('Tone'),
          Wrap(spacing: 8, children: [for (final t in kTones) _chip(_toneLabel(t), tone == t, () => _setTone(t))]),
          const SizedBox(height: 16),
          const _Label('Message chuno'),
          for (var i = 0; i < msgs.length; i++)
            Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE1E6EE))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(msgs[i], style: const TextStyle(fontSize: 15, height: 1.4)),
                const SizedBox(height: 6),
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  TextButton.icon(onPressed: () => _copy(msgs[i]), icon: const Icon(Icons.copy_rounded, size: 18), label: const Text('Copy')),
                  const SizedBox(width: 4),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF25D366), foregroundColor: Colors.white),
                    onPressed: (_name.trim().isEmpty || _amount <= 0) ? null : () => _whatsapp(msgs[i]),
                    icon: const Icon(Icons.send_rounded, size: 18),
                    label: const Text('WhatsApp'),
                  ),
                ]),
              ]),
            ),
          if (_name.trim().isEmpty || _amount <= 0)
            const Padding(
              padding: EdgeInsets.only(top: 4),
              child: Text('Naam aur amount bharo, phir WhatsApp button chalega.', style: TextStyle(color: Color(0xFF8A94A3), fontSize: 12)),
            ),
        ],
      ),
    );
  }

  String _toneLabel(String t) => switch (t) { 'Friendly' => '😄 Friendly', 'Polite' => '🙏 Polite', _ => '⚠️ Firm' };

  void _setLang(String l) {
    setState(() => language = l);
    if (entry == null) store.updateSettings((s) => s.defaultLanguage = l);
  }

  void _setTone(String t) {
    setState(() => tone = t);
    if (entry == null) store.updateSettings((s) => s.defaultTone = t);
  }

  Future<void> _editUpi(BuildContext context) async {
    final c = TextEditingController(text: store.settings.upiId);
    final v = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Aapki UPI ID'),
        content: TextField(controller: c, decoration: const InputDecoration(hintText: 'name@upi', helperText: 'Har message ke end me jud jayegi'), autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Save')),
        ],
      ),
    );
    if (v != null) store.updateSettings((s) => s.upiId = v);
  }

  Widget _chip(String label, bool sel, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 6, bottom: 4),
        child: ChoiceChip(label: Text(label), selected: sel, onSelected: (_) => onTap(), showCheckmark: false),
      );
}

class _Label extends StatelessWidget {
  const _Label(this.t);
  final String t;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 6),
        child: Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF5A6473), letterSpacing: 0.4)),
      );
}
