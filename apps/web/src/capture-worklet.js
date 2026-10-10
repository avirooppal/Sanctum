/* Same-origin capture only. Output remains silent; no feedback to speakers. */
class SanctumCapture extends AudioWorkletProcessor {
  constructor() { super(); this.remaining = 480000; }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      const copy = new Float32Array(channel.subarray(0, this.remaining));
      this.remaining -= copy.length;
      this.port.postMessage(copy, [copy.buffer]);
    }
    return this.remaining > 0;
  }
}
registerProcessor('sanctum-capture', SanctumCapture);
