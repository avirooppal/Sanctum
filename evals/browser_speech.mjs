/** Real browser file dictation, chat and playback smoke; no physical audio claim.
 * node evals/browser_speech.mjs PLAYWRIGHT_PACKAGE TOKEN_FILE WAV ASR TTS VOICE
 * Requires a configured local gateway at 127.0.0.1:8766 and provisioned Chromium.
 */
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [packagePath, tokenFile, wav, asr, tts, voice] = process.argv.slice(2);
const require = createRequire(import.meta.url);
const {chromium} = require(packagePath);
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
const failures = [];
page.on('pageerror', error => failures.push(error.message));
const passed = [];
try {
  const response = await page.goto('http://127.0.0.1:8766');
  const csp = response.headers()['content-security-policy'];
  assert(csp.includes("connect-src 'self'") && csp.includes('media-src blob:'));
  passed.push('same_origin_and_blob_only_media_csp');
  assert.equal(await page.locator('aside').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(22, 62, 50)');
  assert((await page.locator('aside').evaluate(node => getComputedStyle(node.parentElement).gridTemplateColumns)).startsWith('250px'));
  passed.push('compiled_tailwind_desktop_styles');
  await page.getByLabel('Local access key').fill(readFileSync(tokenFile, 'utf8').trim());
  await page.getByRole('button', {name:'Open workspace'}).click();
  await page.getByText('Local speech', {exact:true}).click();
  await page.getByLabel('ASR model', {exact:true}).fill(asr);
  await page.getByLabel('TTS model', {exact:true}).fill(tts);
  await page.getByLabel('Voice', {exact:true}).fill(voice);
  await page.getByLabel('Dictate from WAV', {exact:true}).setInputFiles(wav);
  await page.getByRole('status').filter({hasText:'Transcript added'}).waitFor({timeout:170000});
  assert((await page.getByLabel('Message', {exact:true}).inputValue()).includes('Americans'));
  passed.push('real_wav_dictation_to_draft');
  await page.getByLabel('Message', {exact:true}).fill('Reply with one short sentence welcoming me.');
  await page.getByRole('button', {name:'Send ↑', exact:true}).click();
  await page.getByRole('button', {name:'Read answer', exact:true}).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Send ↑'));
  passed.push('real_chat_response');
  await page.getByRole('button', {name:'Read answer', exact:true}).click();
  await page.getByRole('status').filter({hasText:/Playing locally|Playback finished/}).waitFor({timeout:170000});
  passed.push('browser_audio_play_promise_resolved');
  await page.getByRole('button', {name:'Stop audio', exact:true}).click();
  assert.equal(await page.getByRole('status').textContent(), 'Stopped.');
  passed.push('stop_control');
  assert.deepEqual(failures, []);
  await page.screenshot({path:'.sanctum/browser-speech.png', fullPage:true});
  await page.setViewportSize({width:390, height:844});
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({path:'.sanctum/browser-speech-mobile.png', fullPage:true});
  passed.push('mobile_no_horizontal_overflow');
  const record = {suite:'real-browser-speech', passed, page_errors:failures, physical_playback_verified:false, microphone_verified:false};
  writeFileSync('evals/results/speech-browser.json', JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify(record,null,2));
} finally { await browser.close(); }
