import React, {useEffect, useMemo, useRef, useState} from 'react';
import {SpeechController} from './speech';

export function SpeechPanel({token, answer, conversation, onTranscript}: {
  token: string; answer: string; conversation: string; onTranscript: (text: string) => void;
}) {
  const [asr, setAsr] = useState('');
  const [tts, setTts] = useState('');
  const [voice, setVoice] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const controller = useMemo(() => new SpeechController(token, {
    fetch: (...args) => fetch(...args),
    play: blob => {
      const operation = generation.current;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const release = () => { audio.pause(); audio.removeAttribute('src'); URL.revokeObjectURL(url); };
      audio.onended = () => { release(); if (operation === generation.current) setStatus('Playback finished.'); };
      audio.play().then(() => { if (operation === generation.current) setStatus('Playing locally.'); }).catch(() => {
        release(); if (operation === generation.current) setStatus('Playback was blocked or unavailable. Press Read answer to retry.');
      });
      return release;
    },
  }), [token]);
  useEffect(() => {
    generation.current++; controller.stop(); setBusy(false); setStatus('');
    return () => { generation.current++; controller.stop(); };
  }, [controller, conversation]);
  async function transcribe(file: File | undefined) {
    if (!file) return;
    const operation = ++generation.current;
    setBusy(true); setStatus('Transcribing locally…');
    try {
      const text = await controller.transcribe(file, asr);
      if (text !== null && operation === generation.current) { onTranscript(text); setStatus('Transcript added to your draft. Review before sending.'); }
    } catch (error) {
      if (operation === generation.current && !(error instanceof DOMException && error.name === 'AbortError')) setStatus(String(error));
    } finally { if (operation === generation.current) setBusy(false); }
  }
  async function speak() {
    const operation = ++generation.current;
    setBusy(true); setStatus('Preparing local audio…');
    try { await controller.speak(answer, tts, voice); }
    catch (error) {
      if (operation === generation.current && !(error instanceof DOMException && error.name === 'AbortError')) setStatus(String(error));
    } finally { if (operation === generation.current) setBusy(false); }
  }
  return <details className="border border-[#c6d3c7] rounded-xl p-3 mt-3">
    <summary className="cursor-pointer text-sm">Local speech</summary>
    <p className="text-xs my-3">Use the model and voice IDs from your configured local profiles. WAV: mono 16 kHz PCM16.</p>
    <div className="flex gap-3 flex-wrap text-sm">
      <label>ASR model <input aria-label="ASR model" className="border rounded p-2" value={asr} onChange={e => setAsr(e.target.value)} /></label>
      <label>TTS model <input aria-label="TTS model" className="border rounded p-2" value={tts} onChange={e => setTts(e.target.value)} /></label>
      <label>Voice <input aria-label="Voice" className="border rounded p-2" value={voice} onChange={e => setVoice(e.target.value)} /></label>
    </div>
    <div className="flex gap-3 flex-wrap mt-3 text-sm">
      <label>Dictate from WAV <input aria-label="Dictate from WAV" type="file" accept=".wav,audio/wav" disabled={busy || !asr.trim()} onChange={e => { void transcribe(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <button type="button" disabled={busy || !answer || !tts.trim() || !voice.trim()} onClick={speak} className="border rounded px-3 py-1">Read answer</button>
      <button type="button" onClick={() => { generation.current++; controller.stop(); setBusy(false); setStatus('Stopped.'); }} className="border rounded px-3 py-1">Stop audio</button>
    </div>
    <p role="status" className="text-sm mt-2">{status}</p>
  </details>;
}
