import 'package:audioplayers/audioplayers.dart';

/// Short, optional feedback sounds for Vault interactions.
///
/// The service intentionally owns a small player pool so a bump cannot stop a
/// pour or a tap cannot block the next interaction. Sound remains opt-in and
/// all playback failures are swallowed: money operations must never fail just
/// because a browser or Android device blocks audio.
enum VaultSound { tap, bump, pour, drain, transfer, success, warning, undo }

class SoundService {
  SoundService() : _players = List<AudioPlayer>.generate(3, (_) => AudioPlayer());

  final List<AudioPlayer> _players;
  int _next = 0;

  bool enabled = false;
  double volume = 0.62;

  Future<void> play(VaultSound sound) async {
    if (!enabled) return;
    final player = _players[_next++ % _players.length];
    try {
      await player.stop();
      await player.play(AssetSource('sounds/${sound.name}.wav'), volume: volume);
    } catch (_) {
      // Browser autoplay policies and device audio services may reject sound.
      // The rest of Vault must continue normally.
    }
  }

  Future<void> dispose() async {
    await Future.wait(_players.map((player) => player.dispose()));
  }
}
