// Web: read the legacy BaatBanao PWA data from localStorage (same origin only).
import 'package:web/web.dart' as web;

String? readLegacyStorage(String key) {
  try {
    return web.window.localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}
