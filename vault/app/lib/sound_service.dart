import 'package:audioplayers/audioplayers.dart';

/// Short, optional feedback sounds for Vault interactions.
///
/// The service lazily creates a small player pool so sound remains opt-in and
/// non-blocking. Headless unit tests or platforms without native audio
/// channel support will gracefully degrade with zero crashes.
enum VaultSound { tap, bump, pour, drain, transfer, success, warning, undo }

class SoundService {
  SoundService();

  List<AudioPlayer>? _players;
  int _next = 0;

  bool enabled = false;
  double volume = 0.62;

  List<AudioPlayer> get _pool {
    if (_players == null) {
      try {
        _players = List<AudioPlayer>.generate(3, (_) => AudioPlayer());
      } catch (_) {
        _players = [];
      }
    }
    return _players!;
  }

  Future<void> play(VaultSound sound) async {
    if (!enabled) return;
    try {
      final pool = _pool;
      if (pool.isEmpty) return;
      final player = pool[_next++ % pool.length];
      await player.stop();
      await player.play(AssetSource('sounds/${sound.name}.wav'), volume: volume);
    } catch (_) {
      // Browser autoplay policies, headless tests and device audio services may reject sound.
      // The rest of Vault must continue normally.
    }
  }

  Future<void> dispose() async {
    if (_players != null) {
      final list = _players!;
      _players = null;
      await Future.wait(list.map((player) => player.dispose().catchError((_) {})));
    }
  }
}
