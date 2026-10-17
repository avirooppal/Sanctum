/** Real configured-runtime onboarding subflow; not full J2 acceptance. */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const [pkg,tokenFile,output]=process.argv.slice(2);
const {chromium}=createRequire(import.meta.url)(pkg);
const base=new URL(process.env.SANCTUM_BASE_URL??'http://127.0.0.1:8769');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();const foreign=[];const errors=[];
await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==base.origin){foreign.push(u.origin);return r.abort();}return r.continue();});
await context.routeWebSocket('**/*',s=>{const u=new URL(s.url());u.protocol=u.protocol==='wss:'?'https:':'http:';if(u.origin!==base.origin){foreign.push(u.origin);s.close();}else s.connectToServer();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
let clicks=0,textEntries=0;const start=performance.now();
try {
 await page.goto(new URL('?wizard=1',base).href);
 assert((await page.getByRole('region',{name:'First-run setup'}).innerText()).includes('Unknown'));
 await page.getByLabel('Local access key',{exact:true}).fill('incorrect-owner-key');textEntries++;
 await page.getByRole('button',{name:'Check local runtime',exact:true}).click();clicks++;
 await page.getByRole('alert').filter({hasText:'The local access key was not accepted.'}).waitFor();
 await page.getByLabel('Local access key',{exact:true}).fill(readFileSync(tokenFile,'utf8').trim());textEntries++;
 await page.getByRole('button',{name:'Check local runtime',exact:true}).click();clicks++;
 await page.getByRole('heading',{name:'Review local configuration'}).waitFor();
 assert((await page.getByRole('region',{name:'First-run setup'}).innerText()).includes('Ledger unavailable'));
 await page.getByRole('button',{name:'Open workspace',exact:true}).click();clicks++;
 await page.getByLabel('Message',{exact:true}).waitFor();
 await page.locator('[data-startup-checks="passed"]').waitFor();
 await page.keyboard.press('Control+/');assert(await page.getByLabel('Message',{exact:true}).evaluate(e=>e===document.activeElement));
 await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:output.replace(/\.json$/,'.png'),fullPage:true});
 await page.goto(new URL('/docs.html',base).href);
 assert.equal(await page.locator('.docs-layout').evaluate(e=>getComputedStyle(e).display),'block');
 assert.deepEqual(foreign,[]);assert.deepEqual(errors,[]);
 const record={suite:'real-workflow-onboarding-subflow',journeys:['J2','J9','J12'],status:'PASS',clicks,text_entries:textEntries,elapsed_ms:performance.now()-start,foreign_requests:foreign.length,page_errors:errors,full_journey_verified:false,ledger_verified:false,scope:'configured runtime only; no installer, model provisioning, or ledger'};
 writeFileSync(output,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
} finally {await browser.close();}
