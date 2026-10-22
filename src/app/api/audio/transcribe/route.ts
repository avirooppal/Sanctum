import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_WHISPERX_ENDPOINT } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Try communicating with local WhisperX server (port 8000)
    const whisperxEndpoints = [
      `${DEFAULT_WHISPERX_ENDPOINT}/transcribe`,
      `${DEFAULT_WHISPERX_ENDPOINT}/v1/audio/transcriptions`,
      "http://localhost:8000/transcribe",
    ];

    for (const ep of whisperxEndpoints) {
      try {
        const whisperReqData = new FormData();
        whisperReqData.append("audio_file", file, "audio.wav");
        whisperReqData.append("file", file, "audio.wav");
        whisperReqData.append("model", "base");

        const res = await fetch(ep, {
          method: "POST",
          body: whisperReqData,
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const data = await res.json();
          // Extract text from whisperX or standard OpenAI whisper format
          let text = "";
          if (typeof data.text === "string") {
            text = data.text;
          } else if (Array.isArray(data.segments)) {
            text = data.segments.map((s: any) => s.text).join(" ").trim();
          }

          return NextResponse.json({
            success: true,
            provider: "whisperX",
            endpoint: ep,
            text: text.trim(),
            segments: data.segments || [],
            language: data.language || "en",
          });
        }
      } catch {
        // try next endpoint
      }
    }

    // If WhisperX server is offline, return status so frontend can use Web Speech API
    return NextResponse.json({
      success: false,
      whisperxAvailable: false,
      message: "WhisperX server is not currently reachable on localhost:8000.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Transcription failed" }, { status: 500 });
  }
}
