# Web speech controller v1

Opt-in same-origin file speech controls use the existing authenticated speech API.
Model and voice IDs are supplied explicitly from the operator's configured profiles;
the client embeds no default model names. Credentials and audio stay in memory.

`transcribe(file, model)` accepts a WAV at most 8 MiB and returns text for the draft,
never automatically sends it to chat. `speak(text, model, voice)` requests WAV and
plays it locally. `stop()` aborts a pending request, stops playback and revokes its
object URL. A monotonically increasing operation ID discards stale responses even
when transport cancellation races. Starting another operation stops the previous one.
Unmount and conversation changes call stop. No microphone permission is requested.

Limits: generated audio at most 1 MiB, no remote URLs, no browser speech-recognition
service, no browser speech-synthesis fallback. Stop cancels client delivery/playback;
the isolated server worker may continue until its existing deadline. This slice is
file dictation and playback, not server-side barge-in or streaming ASR.

Static UI CSP permits `media-src blob:` for locally generated audio object URLs;
all network connections remain `connect-src 'self'`. No remote media is allowed.
