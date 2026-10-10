# Web speech controller v1

Opt-in same-origin file speech controls use the existing authenticated speech API.
Model and voice IDs are supplied explicitly from the operator's configured profiles;
the client embeds no default model names. Credentials and audio stay in memory.

`transcribe(file, model)` accepts a WAV at most 8 MiB and returns text for the draft,
never automatically sends it to chat. `speak(text, model, voice)` requests WAV and
plays it locally. `stop()` aborts a pending request, stops playback and revokes its
object URL. A monotonically increasing operation ID discards stale responses even
when transport cancellation races. Starting another operation stops the previous one.
Unmount and conversation changes call stop. Microphone permission is requested only
after Start microphone. Finish dictation closes tracks/context and uploads a WAV;
Stop audio, navigation and unmount discard capture without uploading.

Limits: generated audio at most 1 MiB, no remote URLs, no browser speech-recognition
service, no browser speech-synthesis fallback. Stop cancels client delivery/playback;
the isolated server worker may continue until its existing deadline. This slice is
dictation and playback, not server-side barge-in or streaming ASR.

Static UI CSP permits `media-src blob:` for locally generated audio object URLs;
all network connections remain `connect-src 'self'`. No remote media is allowed.

Microphone capture v1: a same-origin AudioWorklet emits mono Float32 frames from an
AudioContext configured at 16 kHz. Refuse a different actual context rate. Clamp and
encode samples as little-endian PCM16 WAV; finite samples only, at most 30 seconds
(480,000 samples). Reaching the cap stops capture; the user reviews before upload.
No recording is persisted. Browser/device refusal is an explicit error, no cloud or
browser speech API fallback. A canceled pending permission request must stop its
tracks if it resolves later. Playback is stopped before requesting microphone access.
