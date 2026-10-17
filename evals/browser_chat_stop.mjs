/** Real local-engine stop and explicit next-send test. No intercepted API replies. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [packagePath,tokenFile,output]=process.argv.slice(2);
const {chromium}=createRequire(import.meta.url)(packagePath);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();const failures=[];const requests=[];
page.on('pageerror',error=>failures.push(error.message));
page.on('request',request=>{if(request.url().endsWith('/v1/chat/completions'))requests.push(request);});
try {
  await page.goto(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');
  await page.getByLabel('Local access key').fill(readFileSync(tokenFile,'utf8').trim());
  await page.getByRole('button',{name:'Unlock',exact:true}).click();
  await page.getByLabel('Model',{exact:true}).waitFor();
  await page.getByLabel('Message',{exact:true}).fill('Count from 1 to 200, spelling every number out in English. Do not summarize.');
  const started=page.waitForRequest(request=>request.url().endsWith('/v1/chat/completions'));
  await page.getByRole('button',{name:'Send ↑',exact:true}).click();
  await started;
  const failed=page.waitForEvent('requestfailed',{predicate:request=>request===requests[0]});
  const start=performance.now();
  await page.getByRole('button',{name:'Stop generation',exact:true}).click();
  await page.getByText('Generation stopped. Partial text is not guaranteed to be saved.',{exact:true}).waitFor();
  const release=performance.now()-start;
  await failed;
  assert.equal(requests.length,1,'Stop must not retry');
  assert.equal(await page.getByRole('alert').count(),0);
  await page.getByLabel('Message',{exact:true}).fill('Reply only with the word hello.');
  await page.getByRole('button',{name:'Send ↑',exact:true}).click();
  await page.getByRole('button',{name:'Stop generation',exact:true}).waitFor({state:'hidden'});
  assert.equal(requests.length,2);
  assert((await page.locator('article').last().textContent()).toLowerCase().includes('hello'));
  assert.deepEqual(failures,[]);
  const result={suite:'real-chat-stop',passed:['request_aborted','no_automatic_retry','no_abort_error','explicit_next_send_succeeds'],
    browser_stop_to_idle_ms:release,engine_slot_release_measured:false,page_errors:failures};
  writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
