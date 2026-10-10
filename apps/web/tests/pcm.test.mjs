import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PcmCaptureBuffer} from '../build/tests/pcm.js';

test('encodes finite mono PCM16 with accurate WAV header and clamping', async () => {
  const buffer = new PcmCaptureBuffer(10);
  buffer.append(new Float32Array([-2,-1,0,1,2]));
  const view = new DataView(await buffer.wav().arrayBuffer());
  assert.equal(view.getUint32(24,true),16000);
  assert.equal(view.getUint16(22,true),1);
  assert.equal(view.getUint16(34,true),16);
  assert.equal(view.getUint32(40,true),10);
  assert.deepEqual(Array.from({length:5},(_,i)=>view.getInt16(44+i*2,true)),[-32768,-32768,0,32767,32767]);
});

test('bounded memory accepts no partial overflow and resets after discard', () => {
  const buffer = new PcmCaptureBuffer(2);
  buffer.append(new Float32Array([.1,.2]));
  assert.throws(()=>buffer.append(new Float32Array([.3])),/limit/);
  assert.equal(buffer.samples,2);
  buffer.clear(); assert.equal(buffer.samples,0);
  assert.throws(()=>buffer.wav(),/empty/);
});

test('rejects nonfinite data without mutating captured audio', () => {
  const buffer = new PcmCaptureBuffer(2);
  assert.throws(()=>buffer.append(new Float32Array([.1,NaN])),/finite/);
  assert.equal(buffer.samples,0);
});
