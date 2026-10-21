"use client";

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Check, X, Sparkles, Volume2, AlertCircle } from "lucide-react";

interface VoiceRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  onClose: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscriptionComplete,
  onClose,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    startListening();
    return () => {
      stopListening();
    };
  }, []);

  const startListening = async () => {
    // 1. Initialize Real Speech Recognition (Browser Web Speech API)
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let finalStr = "";
        let interimStr = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalStr += event.results[i][0].transcript + " ";
          } else {
            interimStr += event.results[i][0].transcript;
          }
        }

        if (finalStr) {
          setTranscribedText((prev) => (prev ? `${prev} ${finalStr.trim()}` : finalStr.trim()));
        }
        setInterimText(interimStr);
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          setErrorMsg(`Microphone error: ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        // already started
      }
    } else {
      setErrorMsg("Web Speech API not supported in this browser. Please type or use Chrome/Edge.");
    }

    // 2. Real Web Audio API Waveform from Physical Microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsRecording(true);
      setElapsedSeconds(0);

      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);

      drawWaveform();
    } catch {
      setErrorMsg("Microphone permission denied or no audio hardware detected.");
    }
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgb(15, 15, 20)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#818cf8";
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // stopped
      }
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    setIsRecording(false);
  };

  const handleApply = () => {
    stopListening();
    const finalText = `${transcribedText} ${interimText}`.trim();
    if (finalText) {
      onTranscriptionComplete(finalText);
    }
    onClose();
  };

  const currentDisplayText = `${transcribedText} ${interimText}`.trim();

  return (
    <div className="p-4 bg-zinc-950 border border-indigo-500/30 rounded-2xl shadow-glass space-y-3 animate-in fade-in duration-150">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
          <Volume2 className="w-4 h-4 animate-pulse text-indigo-400" />
          <span>Real-time Speech Recognition</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
            Native Audio Stream
          </span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Real-time Hardware Waveform */}
      <div className="relative rounded-xl overflow-hidden border border-white/5 bg-zinc-900">
        <canvas ref={canvasRef} width={480} height={60} className="w-full h-14" />
        <div className="absolute top-2 right-3 font-mono text-[10px] text-zinc-400 bg-black/70 px-2 py-0.5 rounded">
          {Math.floor(elapsedSeconds / 60)}:
          {(elapsedSeconds % 60).toString().padStart(2, "0")}
        </div>
      </div>

      {/* Live Transcribed Text Display */}
      <div className="min-h-12 p-3 rounded-lg bg-zinc-900/80 border border-white/5 text-xs text-zinc-200 font-sans">
        {currentDisplayText ? (
          <span>
            {transcribedText} <span className="text-zinc-400 italic">{interimText}</span>
          </span>
        ) : (
          <span className="text-zinc-500 italic">
            Speak into your microphone. Words are transcribed live...
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] font-mono text-zinc-500">
          {isRecording ? "Live Microphone Active" : "Stopped"}
        </span>

        <div className="flex items-center gap-2">
          {isRecording && (
            <button
              onClick={stopListening}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={handleApply}
            disabled={!currentDisplayText}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Insert Spoken Text</span>
          </button>
        </div>
      </div>
    </div>
  );
};
