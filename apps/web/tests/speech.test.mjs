import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpeechController} from '../build/tests/speech.js';

test('uses same-origin multipart and bearer auth without storing credentials', async () => {
  let captured;
  const controller = new SpeechController('secret', {
    fetch: async (url, options) => { captured = {url, options}; return Response.json({text:'local words'}); },
    play: () => { throw Error('unexpected playback'); },
  });
  assert.equal(await controller.transcribe(new File(['wav'], 'clip.wav'), 'local-asr'), 'local words');
  assert.equal(captured.url, '/v1/audio/transcriptions');
  assert.equal(captured.options.headers.Authorization, 'Bearer secret');
  assert.equal(captured.options.body.get('model'), 'local-asr');
});

test('stop discards stale audio even if fetch ignores abort', async () => {
  let resolve;
  let played = 0;
  const controller = new SpeechController('secret', {
    fetch: () => new Promise(r => { resolve = r; }),
    play: () => { played++; return () => {}; },
  });
  const pending = controller.speak('hello', 'local-tts', 'voice');
  controller.stop();
  resolve(new Response(new Blob(['wav'], {type:'audio/wav'})));
  assert.equal(await pending, false);
  assert.equal(played, 0);
});

test('stop releases playback and next operation cannot reuse it', async () => {
  let stopped = 0;
  const controller = new SpeechController('secret', {
    fetch: async () => new Response(new Blob(['wav'], {type:'audio/wav'})),
    play: () => () => { stopped++; },
  });
  assert.equal(await controller.speak('hello', 'tts', 'voice'), true);
  controller.stop(); controller.stop();
  assert.equal(stopped, 1);
});

test('rejects oversized inputs and unexpected audio content types', async () => {
  let calls = 0;
  const controller = new SpeechController('secret', {
    fetch: async () => { calls++; return new Response('unsafe', {headers:{'Content-Type':'text/html'}}); },
    play: () => { throw Error('unexpected playback'); },
  });
  await assert.rejects(controller.transcribe(new File([new Uint8Array(8*1024*1024+1)], 'large.wav'), 'asr'));
  assert.equal(calls, 0);
  await assert.rejects(controller.speak('hello', 'tts', 'voice'), /audio/);
});
