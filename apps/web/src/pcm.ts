/** Bounded 16 kHz mono PCM buffer. Never persists device audio. */
export class PcmCaptureBuffer {
  private data: Int16Array;
  samples = 0;
  constructor(readonly maxSamples = 480000) {
    if (!Number.isInteger(maxSamples) || maxSamples < 1 || maxSamples > 480000) throw Error('Invalid capture limit');
    this.data = new Int16Array(maxSamples);
  }
  append(frame: Float32Array): void {
    if (this.samples + frame.length > this.maxSamples) throw Error('Capture limit reached');
    if (!frame.every(Number.isFinite)) throw Error('Audio samples must be finite');
    for (const sample of frame) {
      const clamped = Math.max(-1, Math.min(1, sample));
      this.data[this.samples++] = Math.round(clamped * (clamped < 0 ? 32768 : 32767));
    }
  }
  clear(): void { this.data.fill(0); this.samples = 0; }
  wav(): File {
    if (!this.samples) throw Error('Capture is empty');
    const bytes = new ArrayBuffer(44 + this.samples * 2);
    const view = new DataView(bytes);
    const text = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    text(0, 'RIFF'); view.setUint32(4, 36 + this.samples * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data');
    view.setUint32(40, this.samples * 2, true);
    for (let i = 0; i < this.samples; i++) view.setInt16(44 + i * 2, this.data[i], true);
    return new File([bytes], 'dictation.wav', {type: 'audio/wav'});
  }
}
