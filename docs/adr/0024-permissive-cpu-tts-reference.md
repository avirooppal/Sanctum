# ADR 0024: Permissive CPU TTS reference

Accepted 2026-10-10. Add Flite 2.2 as an opt-in CPU reference behind TTSEngine,
not as a neural-quality default. Its source and built-in voice data are distributed
under the permissive CMU Flite license and the collection's listed permissive notices.
Use `LicenseRef-CMU-Flite` rather than mislabeling it BSD-3-Clause. Preserve COPYING.

Build pinned commit `e9e2e37c329dbe98bfeb27a1828ef9a71fa84f88` with audio-device
support and shared Flite libraries disabled. The measured executable links only the
OS C/math libraries and loader. GPL configure helpers are development tooling and
are not part of the produced runtime, as explained by upstream COPYING. Do not ship
unreviewed audio/phonemizer libraries as an implicit runtime dependency.

Built-in voices are compiled into the executable. Registry format `native-voice` is
therefore allowed only with this reviewed license and TTS capability, and the voice
artifact SHA-256 is the executable SHA-256. Retain model/voice attribution. The stable
profile selects a built-in voice by name; reject file paths/URLs and unregistered IDs.
This exception does not change preferred GGUF/safetensors formats for neural models.

This reference proves local synthesis and lets the voice loop be exercised without
cloud calls. Neural voice quality, native microphone/speaker playback, streaming
engine generation and T1 latency remain separate requirements, not implied successes.
