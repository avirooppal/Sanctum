import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('worklet itself stops after 30 seconds even if UI messages are not handled', () => {
  let Processor;
  let samples = 0;
  runInNewContext(readFileSync(new URL('../src/capture-worklet.js',import.meta.url),'utf8'), {
    AudioWorkletProcessor: class { port = {postMessage(frame){samples += frame.length;}}; },
    registerProcessor(_name, constructor){Processor = constructor;},
    Float32Array,
  });
  const processor = new Processor();
  let running = true;
  let frames = 0;
  while (running && frames < 4000) { running = processor.process([[new Float32Array(128)]]); frames++; }
  assert.equal(running,false);
  assert.equal(samples,480000);
  assert.equal(frames,3750);
});
