import {PcmCaptureBuffer} from './pcm';

export class MicrophoneCapture {
  private generation = 0;
  private stream: MediaStream | undefined;
  private context: AudioContext | undefined;
  private node: AudioWorkletNode | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private buffer = new PcmCaptureBuffer();

  private closeDevice(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.node) { this.node.port.onmessage = null; this.node.disconnect(); this.node.port.close(); }
    this.node = undefined;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = undefined;
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
  }
  cancel(): void { this.generation++; this.closeDevice(); this.buffer.clear(); }

  async start(onLimit: () => void, onError: (message: string) => void): Promise<boolean> {
    this.cancel();
    const generation = this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1}, video: false});
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false; }
    this.stream = stream;
    let stage = 'audio context';
    try {
      const context = new AudioContext({sampleRate: 16000});
      this.context = context;
      if (context.sampleRate !== 16000) throw Error('This browser cannot capture at 16 kHz.');
      stage = 'capture worklet';
      await context.audioWorklet.addModule(new URL('./capture-worklet.js', import.meta.url));
      if (generation !== this.generation) return false;
      const node = new AudioWorkletNode(context, 'sanctum-capture');
      this.node = node;
      node.port.onmessage = event => {
        if (generation !== this.generation) return;
        try {
          if (!(event.data instanceof Float32Array)) throw Error('Invalid captured frame');
          const remaining = this.buffer.maxSamples - this.buffer.samples;
          this.buffer.append(event.data.subarray(0, remaining));
          if (this.buffer.samples === this.buffer.maxSamples) { this.closeDevice(); onLimit(); }
        } catch (error) { this.cancel(); onError(String(error)); }
      };
      stage = 'device input';
      context.createMediaStreamSource(stream).connect(node);
      node.connect(context.destination);
      stage = 'capture start';
      await context.resume();
      if (generation === this.generation) this.timer = setTimeout(() => { this.closeDevice(); onLimit(); }, 30000);
      return generation === this.generation;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.cancel(); throw Error(`${stage}: ${String(error)}`);
    }
  }
  finish(): File {
    this.generation++;
    this.closeDevice();
    try { return this.buffer.wav(); } finally { this.buffer.clear(); }
  }
}
