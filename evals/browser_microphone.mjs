/** Emulated-device capture using a real local fixture; no physical mic claim.
 * node evals/browser_microphone.mjs PLAYWRIGHT_PACKAGE TOKEN_FILE WAV ASR
 */
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [packagePath, tokenFile, wav, asr] = process.argv.slice(2);
const {chromium} = createRequire(import.meta.url)(packagePath);
const browser = await chromium.launch({channel:'chromium', headless:true, args:[
  '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${resolve(wav)}`,
]});
const context = await browser.newContext({permissions:['microphone']});
const page = await context.newPage();
await page.addInitScript(() => {
  window.testTracks = [];
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async options => {
    const stream = await original(options);
    window.testTracks.push(...stream.getTracks());
    return stream;
  };
});
let uploads = 0;
const errors = [];
page.on('request', request => { if (request.url().endsWith('/v1/audio/transcriptions')) uploads++; });
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:8766');
  await page.getByLabel('Local access key').fill(readFileSync(tokenFile,'utf8').trim());
  await page.getByRole('button',{name:'Open workspace'}).click();
  await page.getByText('Local speech',{exact:true}).click();
  await page.getByLabel('ASR model',{exact:true}).fill(asr);
  assert.equal(await page.evaluate(()=>window.testTracks.length),0);
  await page.getByRole('button',{name:'Start microphone',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Recording locally'}).waitFor();
  // Capture the real eleven-second fixture through Chromium's emulated device.
  await page.waitForTimeout(12000);
  await page.getByRole('button',{name:'Finish dictation',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Transcript added'}).waitFor({timeout:170000});
  const transcript = await page.getByLabel('Message',{exact:true}).inputValue();
  assert(transcript.trim().length > 0);
  assert.equal(uploads,1);
  assert(await page.evaluate(()=>window.testTracks.every(t=>t.readyState==='ended')));
  await page.getByRole('button',{name:'Start microphone',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Recording locally'}).waitFor();
  await page.getByRole('button',{name:'Stop audio',exact:true}).click();
  assert(await page.evaluate(()=>window.testTracks.every(t=>t.readyState==='ended')));
  assert.equal(uploads,1);
  assert.deepEqual(errors,[]);
  const record = {
    suite:'emulated-browser-microphone',
    passed:['no_capture_before_click','real_worklet_to_local_asr','finish_closes_tracks','cancel_closes_tracks_without_upload'],
    transcript, page_errors:errors, physical_microphone_verified:false,
  };
  writeFileSync('evals/results/speech-microphone.json',JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record,null,2));
} catch (error) {
  console.error('Speech status:', await page.getByRole('status').textContent());
  console.error('Page errors:', errors);
  throw error;
} finally {await browser.close();}
