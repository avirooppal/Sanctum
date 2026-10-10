type Dependencies = {
  fetch: typeof fetch;
  play: (audio: Blob) => () => void;
};

/** Same-origin, in-memory speech transport; cancellation suppresses stale delivery. */
export class SpeechController {
  private generation = 0;
  private request: AbortController | undefined;
  private stopPlayback: (() => void) | undefined;

  constructor(private token: string, private dependencies: Dependencies) {}

  stop(): void {
    this.generation++;
    this.request?.abort();
    this.request = undefined;
    this.stopPlayback?.();
    this.stopPlayback = undefined;
  }

  private begin() {
    this.stop();
    this.request = new AbortController();
    return {generation: this.generation, signal: this.request.signal};
  }

  async transcribe(file: File, model: string): Promise<string | null> {
    if (!model.trim() || file.size === 0 || file.size > 8 * 1024 * 1024) {
      throw Error('Choose a configured ASR model and a WAV file smaller than 8 MiB.');
    }
    const operation = this.begin();
    const body = new FormData();
    body.append('model', model);
    body.append('file', file);
    const response = await this.dependencies.fetch('/v1/audio/transcriptions', {
      method: 'POST', headers: {Authorization: `Bearer ${this.token}`},
      body, signal: operation.signal,
    });
    if (operation.generation !== this.generation) return null;
    if (!response.ok) throw Error('Local transcription failed. Check the configured model and WAV format.');
    const result = await response.json();
    if (operation.generation !== this.generation) return null;
    if (typeof result.text !== 'string') throw Error('Invalid transcription response.');
    return result.text;
  }

  async speak(text: string, model: string, voice: string): Promise<boolean> {
    if (!text.trim() || text.length > 10000 || !model.trim() || !voice.trim()) {
      throw Error('Choose a configured TTS model and voice; text must be 1–10,000 characters.');
    }
    const operation = this.begin();
    const response = await this.dependencies.fetch('/v1/audio/speech', {
      method: 'POST', headers: {Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({model, voice, input: text, response_format: 'wav'}),
      signal: operation.signal,
    });
    if (operation.generation !== this.generation) return false;
    if (!response.ok) throw Error('Local synthesis failed. Check the configured model and voice.');
    if (response.headers.get('Content-Type')?.split(';')[0] !== 'audio/wav') {
      throw Error('Unexpected audio response.');
    }
    const audio = await response.blob();
    if (operation.generation !== this.generation) return false;
    if (audio.size === 0 || audio.size > 1024 * 1024) throw Error('Invalid audio size.');
    this.stopPlayback = this.dependencies.play(audio);
    return true;
  }
}
