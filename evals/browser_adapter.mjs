/** Run the compiled first-party adapter against the real guarded gateway. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [packagePath,tokenFile,output] = process.argv.slice(2);
const require=createRequire(import.meta.url);
const {chromium}=require(packagePath);
const base=new URL(process.env.SANCTUM_BASE_URL ?? 'http://127.0.0.1:8769');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const foreign=[];
await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin !== base.origin){foreign.push(url.origin);return route.abort();}
  if(url.pathname === '/__adapter_check.mjs') return route.fulfill({
    contentType:'text/javascript',body:readFileSync('apps/web/build/tests/api.js','utf8')});
  return route.continue();
});
try {
  const page=await context.newPage();
  await page.goto(base.href);
  const results=await page.evaluate(async token=>{
    const {SanctumClient}=await import('/__adapter_check.mjs');
    const api=new SanctumClient(token);
    const models=await api.models();
    const model=models.find(m=>m.capabilities.includes('text'));
    if(!model)throw Error('No actual text model available');
    const id=crypto.randomUUID();
    let text='';
    for await(const delta of api.chat(model.id,[{role:'user',content:'Reply with one short greeting.'}],id))text+=delta;
    if(!text.trim())throw Error('No actual model output');
    const history=await api.conversations();
    const turns=await api.turns(id);
    if(!history.includes(id) || !turns.length)throw Error('Actual conversation was not saved');
    const cancel=new AbortController();
    const socket=await api.realtime(undefined,cancel.signal);
    const ready=await new Promise((resolve,reject)=>{
      socket.addEventListener('message',event=>{
        const data=JSON.parse(event.data);
        if(data.type === 'ready')resolve(data);
      });
      socket.addEventListener('error',()=>reject(Error('Real WebSocket failed')),{once:true});
    });
    const closed=new Promise(resolve=>socket.addEventListener('close',event=>resolve(event.code),{once:true}));
    cancel.abort();
    const closeCode=await closed;
    return {models:models.length,characters:text.length,saved_turns:turns.length,
      protocol:ready.protocol,capabilities:ready.data,close_code:closeCode,
      local_storage_entries:localStorage.length,session_storage_entries:sessionStorage.length};
  },readFileSync(tokenFile,'utf8').trim());
  assert.equal(results.protocol,'sanctum.realtime.v1');
  assert.equal(results.local_storage_entries,0);
  assert.equal(results.session_storage_entries,0);
  assert.equal(foreign.length,0);
  const report={suite:'real-browser-adapter-v1',results,foreign_origins:foreign,
    scope:'HTTP chat/history and authenticated WebSocket transport; no speech pipeline claim'};
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  await context.close();
  await browser.close();
}
